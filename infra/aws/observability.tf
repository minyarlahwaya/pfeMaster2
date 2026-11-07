# -----------------------------------------------------
# Observabilité CloudWatch : alarmes et tableau de bord
# -----------------------------------------------------
# - Métriques EC2 de base (CPU, réseau, contrôles de santé) : gratuites, sans agent.
# - Métriques système (mémoire, disque, swap) et journaux (Nginx, API, sauvegardes) :
#   agent CloudWatch installé par scripts/configure-cloudwatch.sh (job 2.5 du pipeline),
#   avec le profil d'instance LabInstanceProfile (AWS Academy : aucun rôle créable).
# - Groupes de journaux et filtres de métriques : créés par l'agent / le pipeline, HORS
#   Terraform, pour que les journaux survivent à « Destroy » (post-mortem).
# - Notifications : rubrique SNS créée par le pipeline (hors Terraform, sinon chaque
#   destroy supprimerait les abonnements e-mail confirmés), passée dans
#   alarm_sns_topic_arn. Vide = alarmes sans notification.

locals {
  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  cw_namespace  = var.cloudwatch_namespace
  instance_dims = { InstanceId = aws_instance.app.id }
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-cpu-high"
  alarm_description   = "CPU de l'instance > 80 % pendant 10 minutes"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = local.instance_dims
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "status_check" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-status-check-failed"
  alarm_description   = "Contrôle de santé EC2 (système ou instance) en échec"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = local.instance_dims
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-memory-high"
  alarm_description   = "Mémoire utilisée > 85 % pendant 10 minutes (agent CloudWatch)"
  namespace           = local.cw_namespace
  metric_name         = "mem_used_percent"
  dimensions          = local.instance_dims
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "disk_high" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-disk-high"
  alarm_description   = "Disque racine utilisé > 85 % (base PostgreSQL, sauvegardes, versions)"
  namespace           = local.cw_namespace
  metric_name         = "disk_used_percent"
  dimensions          = local.instance_dims
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# Métrique alimentée par le filtre de métriques posé sur le journal d'accès Nginx
# (scripts/configure-cloudwatch.sh) : réponses HTTP 5xx.
resource "aws_cloudwatch_metric_alarm" "http_5xx" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-http-5xx"
  alarm_description   = "Plus de 5 réponses HTTP 5xx en 5 minutes (API ou Nginx en erreur)"
  namespace           = local.cw_namespace
  metric_name         = "Http5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  count               = var.enable_observability ? 1 : 0
  alarm_name          = "${var.project_name}-api-errors"
  alarm_description   = "Plus de 10 lignes d'erreur dans le journal de l'API en 5 minutes"
  namespace           = local.cw_namespace
  metric_name         = "ApiErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_dashboard" "app" {
  count          = var.enable_observability ? 1 : 0
  dashboard_name = var.project_name

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text", x = 0, y = 0, width = 24, height = 2
        properties = {
          markdown = "# ${var.project_name} — instance ${aws_instance.app.id}\nMétriques EC2, système (agent CloudWatch), trafic Nginx et journaux de l'API. Alarmes notifiées par e-mail (SNS)."
        }
      },
      {
        type = "metric", x = 0, y = 2, width = 8, height = 6
        properties = {
          title   = "CPU (%)", region = var.aws_region, view = "timeSeries", stat = "Average", period = 300
          metrics = [["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.app.id]]
          yAxis   = { left = { min = 0, max = 100 } }
        }
      },
      {
        type = "metric", x = 8, y = 2, width = 8, height = 6
        properties = {
          title = "Mémoire et disque (%)", region = var.aws_region, view = "timeSeries", stat = "Average", period = 300
          metrics = [
            [local.cw_namespace, "mem_used_percent", "InstanceId", aws_instance.app.id],
            [local.cw_namespace, "disk_used_percent", "InstanceId", aws_instance.app.id],
            [local.cw_namespace, "swap_used_percent", "InstanceId", aws_instance.app.id],
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type = "metric", x = 16, y = 2, width = 8, height = 6
        properties = {
          title = "Réseau (octets)", region = var.aws_region, view = "timeSeries", stat = "Sum", period = 300
          metrics = [
            ["AWS/EC2", "NetworkIn", "InstanceId", aws_instance.app.id],
            ["AWS/EC2", "NetworkOut", "InstanceId", aws_instance.app.id],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 8, width = 8, height = 6
        properties = {
          title = "Requêtes HTTP et erreurs", region = var.aws_region, view = "timeSeries", stat = "Sum", period = 300
          metrics = [
            [local.cw_namespace, "HttpRequests"],
            [local.cw_namespace, "Http4xx"],
            [local.cw_namespace, "Http5xx"],
            [local.cw_namespace, "ApiErrors"],
          ]
        }
      },
      {
        type = "alarm", x = 8, y = 8, width = 16, height = 6
        properties = {
          title = "État des alarmes"
          alarms = [
            aws_cloudwatch_metric_alarm.cpu_high[0].arn,
            aws_cloudwatch_metric_alarm.status_check[0].arn,
            aws_cloudwatch_metric_alarm.memory_high[0].arn,
            aws_cloudwatch_metric_alarm.disk_high[0].arn,
            aws_cloudwatch_metric_alarm.http_5xx[0].arn,
            aws_cloudwatch_metric_alarm.api_errors[0].arn,
          ]
        }
      },
      {
        type = "log", x = 0, y = 14, width = 24, height = 8
        properties = {
          title  = "Dernières erreurs de l'API (CloudWatch Logs Insights)"
          region = var.aws_region
          view   = "table"
          query  = "SOURCE '/${var.project_name}/backend' | fields @timestamp, @message | filter @message like /(?i)error|exception|fatal/ | sort @timestamp desc | limit 50"
        }
      },
    ]
  })
}
