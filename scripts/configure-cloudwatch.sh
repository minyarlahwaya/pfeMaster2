#!/usr/bin/env bash
# Installe et configure l'agent Amazon CloudWatch sur l'instance (idempotent).
#
#   Métriques (espace de noms --namespace, dimension InstanceId) :
#     mem_used_percent, swap_used_percent, disk_used_percent (/), processus
#   Journaux (groupes /<projet>/..., rétention --retention jours) :
#     /<projet>/nginx-access   /var/log/nginx/access.log
#     /<projet>/nginx-error    /var/log/nginx/error.log
#     /<projet>/backend        API Node.js (journald -> /var/log/syslog, filtré)
#     /<projet>/backup         sauvegardes PostgreSQL quotidiennes
#     /<projet>/cloud-init     installation initiale de la VM
#
# Prérequis : profil d'instance autorisant CloudWatch (AWS Academy : LabInstanceProfile).
# Les groupes de journaux et filtres de métriques sont créés par le pipeline (job 2.5).
#
# Usage : sudo scripts/configure-cloudwatch.sh [--project landolsi-tires]
#                                              [--namespace LandolsiTires] [--retention 14]

set -euo pipefail

PROJECT="landolsi-tires"
NAMESPACE="LandolsiTires"
RETENTION=14

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project) PROJECT="$2"; shift 2 ;;
        --namespace) NAMESPACE="$2"; shift 2 ;;
        --retention) RETENTION="$2"; shift 2 ;;
        -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
        *) echo "Option inconnue : $1" >&2; exit 2 ;;
    esac
done

[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
[[ "$PROJECT" =~ ^[a-z0-9-]+$ ]] || { echo "Nom de projet invalide : $PROJECT" >&2; exit 2; }
[[ "$NAMESPACE" =~ ^[A-Za-z0-9/_-]+$ ]] || { echo "Espace de noms invalide : $NAMESPACE" >&2; exit 2; }
[[ "$RETENTION" =~ ^[0-9]+$ ]] || { echo "Rétention invalide : $RETENTION" >&2; exit 2; }

AGENT_DIR=/opt/aws/amazon-cloudwatch-agent
CTL="$AGENT_DIR/bin/amazon-cloudwatch-agent-ctl"
CONFIG="$AGENT_DIR/etc/landolsi-cloudwatch.json"

# 1. Installation du paquet officiel (signé, téléchargé depuis le bucket AWS)
if [[ ! -x "$CTL" ]]; then
    arch="$(dpkg --print-architecture)"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    base="https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/${arch}/latest"
    echo "Téléchargement de l'agent CloudWatch (${arch})..."
    curl -fsSL --retry 3 -o "$tmp/agent.deb" "$base/amazon-cloudwatch-agent.deb"
    dpkg -i -E "$tmp/agent.deb" >/dev/null
fi
echo "Agent : $("$CTL" -a status 2>/dev/null | grep -o '"version": *"[^"]*"' || echo 'installé')"

# 2. Le profil d'instance doit fournir des identifiants (sinon l'agent tourne à vide)
token="$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
if ! curl -fsS -H "X-aws-ec2-metadata-token: $token" \
        http://169.254.169.254/latest/meta-data/iam/security-credentials/ >/dev/null 2>&1; then
    echo "AUCUN profil IAM sur l'instance : métriques et journaux ne peuvent pas être envoyés." >&2
    echo "AWS Academy : iam_instance_profile = \"LabInstanceProfile\" (variable IAM_INSTANCE_PROFILE du pipeline)." >&2
    exit 3
fi

# 3. Configuration
install -d -m 0755 "$(dirname "$CONFIG")"
cat > "$CONFIG" <<EOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root",
    "logfile": "$AGENT_DIR/logs/amazon-cloudwatch-agent.log"
  },
  "metrics": {
    "namespace": "$NAMESPACE",
    "append_dimensions": { "InstanceId": "\${aws:InstanceId}" },
    "aggregation_dimensions": [["InstanceId"]],
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent", "mem_available"] },
      "swap": { "measurement": ["swap_used_percent"] },
      "disk": {
        "measurement": ["used_percent", "inodes_free"],
        "resources": ["/"],
        "drop_device": true
      },
      "procstat": [
        { "exe": "node",     "measurement": ["pid_count", "memory_rss", "cpu_usage"] },
        { "exe": "postgres", "measurement": ["pid_count", "memory_rss"] },
        { "exe": "nginx",    "measurement": ["pid_count"] }
      ]
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          { "file_path": "/var/log/nginx/access.log", "log_group_name": "/$PROJECT/nginx-access",
            "log_stream_name": "{instance_id}", "retention_in_days": $RETENTION },
          { "file_path": "/var/log/nginx/error.log",  "log_group_name": "/$PROJECT/nginx-error",
            "log_stream_name": "{instance_id}", "retention_in_days": $RETENTION },
          { "file_path": "/var/log/syslog", "log_group_name": "/$PROJECT/backend",
            "log_stream_name": "{instance_id}", "retention_in_days": $RETENTION,
            "filters": [{ "type": "include", "expression": "landolsi-backend" }] },
          { "file_path": "/var/log/syslog", "log_group_name": "/$PROJECT/backup",
            "log_stream_name": "{instance_id}", "retention_in_days": $RETENTION,
            "filters": [{ "type": "include", "expression": "landolsi-backup" }] },
          { "file_path": "/var/log/cloud-init-output.log", "log_group_name": "/$PROJECT/cloud-init",
            "log_stream_name": "{instance_id}", "retention_in_days": $RETENTION }
        ]
      }
    }
  }
}
EOF
chmod 0644 "$CONFIG"

# 4. Démarrage (valide la configuration, active le service au boot)
"$CTL" -a fetch-config -m ec2 -s -c "file:$CONFIG" >/dev/null
systemctl enable --quiet amazon-cloudwatch-agent
sleep 5
if ! systemctl is-active --quiet amazon-cloudwatch-agent; then
    journalctl -u amazon-cloudwatch-agent -n 30 --no-pager >&2 || true
    echo "L'agent CloudWatch ne démarre pas." >&2
    exit 1
fi
echo "Agent CloudWatch actif : espace de noms $NAMESPACE, journaux /$PROJECT/*, rétention $RETENTION j."
