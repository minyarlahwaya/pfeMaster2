variable "aws_region" {
  description = "Région AWS (AWS Academy Learner Lab : généralement us-east-1 ou us-west-2)."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Préfixe des noms et tags des ressources."
  type        = string
  default     = "landolsi-tires"
}

variable "instance_type" {
  description = "Type d'instance. t3.small (2 Go) recommandé : PostgreSQL + Node + build Vite. t3.micro possible (swap créé automatiquement)."
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Nom de la paire de clés EC2 existante (AWS Academy : vockey)."
  type        = string
  default     = "vockey"
}

variable "ssh_public_key" {
  description = "Clé publique SSH supplémentaire autorisée pour l'utilisateur ubuntu (contenu d'un .pub), injectée par cloud-init. AWS Academy interdit ec2:ImportKeyPair."
  type        = string
  default     = ""
}

variable "ssh_allowed_cidr" {
  description = "CIDR autorisé en SSH, idéalement votre IP publique en /32 (ex. 203.0.113.10/32). Aucun défaut : 0.0.0.0/0 est volontairement refusé."
  type        = string

  validation {
    condition     = can(cidrhost(var.ssh_allowed_cidr, 0)) && var.ssh_allowed_cidr != "0.0.0.0/0"
    error_message = "ssh_allowed_cidr doit être un CIDR valide et différent de 0.0.0.0/0."
  }
}

variable "security_group_id" {
  description = "Security Group existant à utiliser (requis dans AWS Academy, voir main.tf). Vide = Terraform crée le groupe."
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Ouvrir le port 443 (nécessaire si un nom de domaine et certbot sont utilisés)."
  type        = bool
  default     = true
}

variable "root_volume_size" {
  description = "Taille du volume racine gp3 (Go) : système, application, base PostgreSQL, sauvegardes."
  type        = number
  default     = 20
}

variable "root_volume_delete_on_termination" {
  description = "Supprimer le volume (et donc la base locale) à la terminaison de l'instance. false par défaut pour protéger les données."
  type        = bool
  default     = false
}

variable "iam_instance_profile" {
  description = "Profil d'instance existant (AWS Academy : LabInstanceProfile; la création de rôles IAM y est généralement interdite). Vide = aucun."
  type        = string
  default     = ""
}

variable "allocate_eip" {
  description = "Associer une IP élastique (IP publique stable après arrêt/démarrage du lab)."
  type        = bool
  default     = false
}

variable "eip_allocation_id" {
  description = "Identifiant (eipalloc-...) d'une IP élastique déjà réservée, à associer à l'instance. Elle n'est PAS libérée par terraform destroy : l'IP et l'URL restent identiques entre deux déploiements. Prioritaire sur allocate_eip."
  type        = string
  default     = ""

  validation {
    condition     = var.eip_allocation_id == "" || can(regex("^eipalloc-[0-9a-f]+$", var.eip_allocation_id))
    error_message = "eip_allocation_id doit être de la forme eipalloc-xxxxxxxx."
  }
}

variable "subnet_id" {
  description = "Sous-réseau public. Vide = premier sous-réseau du VPC par défaut."
  type        = string
  default     = ""
}

variable "git_repo_url" {
  description = "URL HTTPS d'un dépôt Git accessible publiquement pour l'amorçage automatique (cloud-init). Vide = installation manuelle par SSH. Ne jamais y mettre de jeton d'accès."
  type        = string
  default     = ""

  validation {
    condition     = var.git_repo_url == "" || can(regex("^https://[^@]+$", var.git_repo_url))
    error_message = "git_repo_url doit être une URL https:// sans identifiants."
  }
}

variable "git_ref" {
  description = "Branche ou tag déployé par cloud-init."
  type        = string
  default     = "master"
}

variable "enable_observability" {
  description = "Créer les alarmes CloudWatch et le tableau de bord (observability.tf)."
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "ARN de la rubrique SNS notifiée par les alarmes (créée hors Terraform par le pipeline). Vide = alarmes sans notification."
  type        = string
  default     = ""

  validation {
    condition     = var.alarm_sns_topic_arn == "" || can(regex("^arn:aws:sns:", var.alarm_sns_topic_arn))
    error_message = "alarm_sns_topic_arn doit être un ARN SNS (arn:aws:sns:...)."
  }
}

variable "cloudwatch_namespace" {
  description = "Espace de noms des métriques personnalisées (agent CloudWatch, filtres de journaux)."
  type        = string
  default     = "LandolsiTires"
}

variable "external_db" {
  description = "Base PostgreSQL managée (Supabase) : aucun PostgreSQL installé sur la VM ; le pipeline configure la base puis déploie."
  type        = bool
  default     = true
}
