locals {
  public_ip = (
    var.eip_allocation_id != "" ? data.aws_eip.existing[0].public_ip :
    var.allocate_eip ? aws_eip.app[0].public_ip : aws_instance.app.public_ip
  )
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ami_id" {
  description = "AMI Ubuntu 24.04 utilisée"
  value       = aws_instance.app.ami
}

output "public_ip" {
  description = "IP publique (change après arrêt/démarrage sans IP élastique)"
  value       = local.public_ip
}

output "app_url" {
  value = "http://${local.public_ip}/"
}

output "ssh_command" {
  description = "AWS Academy : téléchargez labsuser.pem depuis 'AWS Details'"
  value       = "ssh -i ~/.ssh/labsuser.pem ubuntu@${local.public_ip}"
}

output "sslip_domain" {
  description = "Nom de domaine gratuit pointant vers l'IP publique (HTTPS : install.sh --domain)"
  value       = "landolsi-tires-${replace(local.public_ip, ".", "-")}.sslip.io"
}

output "https_setup_command" {
  description = "À lancer une fois cloud-init terminé pour activer HTTPS (Let's Encrypt)"
  value       = "ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@${local.public_ip} 'sudo /opt/landolsi-src/scripts/install.sh --domain landolsi-tires-${replace(local.public_ip, ".", "-")}.sslip.io'"
}

output "root_volume_id" {
  description = "Volume racine (conservé après terraform destroy si root_volume_delete_on_termination = false)"
  value       = aws_instance.app.root_block_device[0].volume_id
}

output "security_group_id" {
  value = local.security_group_id
}

output "cloudwatch_dashboard_url" {
  description = "Tableau de bord CloudWatch (métriques, alarmes, journaux)"
  value       = var.enable_observability ? "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${var.project_name}" : ""
}
