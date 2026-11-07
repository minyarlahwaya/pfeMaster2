# Une instance EC2 Ubuntu 24.04 : Nginx + API Node.js (systemd) + PostgreSQL local.
# Voir docs/deployment/architecture.md pour la justification.

# Dernière AMI Ubuntu 24.04 LTS officielle (Canonical) de la région courante
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_vpc" "default" {
  count   = var.subnet_id == "" ? 1 : 0
  default = true
}

data "aws_subnets" "default" {
  count = var.subnet_id == "" ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_subnet" "selected" {
  id = var.subnet_id != "" ? var.subnet_id : sort(data.aws_subnets.default[0].ids)[0]
}

# AWS Academy interdit ec2:RevokeSecurityGroupEgress, que le provider AWS
# appelle toujours à la création d'un groupe : dans le lab, créer le groupe avec
# l'AWS CLI (voir aws-academy-deployment.md) et passer security_group_id.
resource "aws_security_group" "app" {
  count       = var.security_group_id == "" ? 1 : 0
  name        = "${var.project_name}-app"
  description = "LANDOLSI TIRES : SSH restreint, HTTP/HTTPS publics. PostgreSQL et API non exposes."
  vpc_id      = data.aws_subnet.selected.vpc_id

  tags = {
    Name = "${var.project_name}-app"
  }
}

locals {
  security_group_id = var.security_group_id != "" ? var.security_group_id : aws_security_group.app[0].id
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = local.security_group_id
  description       = "SSH administrateur"
  cidr_ipv4         = var.ssh_allowed_cidr
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = local.security_group_id
  description       = "HTTP public"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  count             = var.enable_https ? 1 : 0
  security_group_id = local.security_group_id
  description       = "HTTPS public"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# Sortie : apt, npm, NodeSource, Telegram, Gemini, SMTP, base externe éventuelle.
# Un groupe créé hors Terraform garde la règle de sortie AWS par défaut (tout autorisé).
resource "aws_vpc_security_group_egress_rule" "all" {
  count             = var.security_group_id == "" ? 1 : 0
  security_group_id = aws_security_group.app[0].id
  description       = "Sortie Internet"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = data.aws_subnet.selected.id
  vpc_security_group_ids      = [local.security_group_id]
  associate_public_ip_address = true
  iam_instance_profile        = var.iam_instance_profile != "" ? var.iam_instance_profile : null

  user_data = templatefile("${path.module}/../cloud-init/user-data.yaml.tftpl", {
    git_repo_url   = var.git_repo_url
    git_ref        = var.git_ref
    ssh_public_key = var.ssh_public_key
    external_db    = var.external_db
  })

  # IMDSv2 obligatoire
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = var.root_volume_delete_on_termination
  }

  tags = {
    Name = "${var.project_name}-app"
  }

  lifecycle {
    # Une nouvelle AMI ou un user_data modifié ne doit pas recréer l'instance
    # (ce qui supprimerait les images téléversées).
    ignore_changes = [ami, user_data]
  }
}

# -----------------------------------------------------
# IP élastique
# -----------------------------------------------------
# eip_allocation_id renseigné : IP réservée HORS de Terraform (conservée par
# terraform destroy => même IP, même URL sslip.io d'un déploiement à l'autre).
# Sinon, allocate_eip = true crée une IP gérée par Terraform (libérée au destroy).

locals {
  use_existing_eip = var.eip_allocation_id != ""
  use_eip          = local.use_existing_eip || var.allocate_eip
}

data "aws_eip" "existing" {
  count = local.use_existing_eip ? 1 : 0
  id    = var.eip_allocation_id
}

resource "aws_eip" "app" {
  count  = var.allocate_eip && !local.use_existing_eip ? 1 : 0
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}

resource "aws_eip_association" "app" {
  count         = local.use_eip ? 1 : 0
  instance_id   = aws_instance.app.id
  allocation_id = local.use_existing_eip ? data.aws_eip.existing[0].id : aws_eip.app[0].id
}
