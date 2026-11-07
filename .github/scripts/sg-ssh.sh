#!/usr/bin/env bash
# Ouverture « juste-à-temps » du port SSH pour le runner GitHub Actions.
#
# Le Security Group n'autorise SSH que depuis ADMIN_SSH_CIDR (fermé par défaut).
# Un job qui doit se connecter à l'instance ajoute une règle temporaire pour
# l'IP publique de SON runner (/32), puis la retire dans une étape « always() ».
#
# Usage : SG_ID=sg-... sg-ssh.sh open|close|purge
#   open   autorise <IP du runner>/32 sur le port 22 (description gha-<run>-<job>)
#   close  retire la règle ajoutée par « open » dans ce même job
#   purge  retire toutes les règles temporaires gha-* restées dans le groupe
#          (job annulé avant son étape de nettoyage)

set -euo pipefail

action="${1:?usage: sg-ssh.sh open|close|purge}"
sg="${SG_ID:?SG_ID requis}"
desc="gha-${GITHUB_RUN_ID:-local}-${GITHUB_JOB:-job}"

runner_ip() {
    if [[ -z "${RUNNER_IP:-}" ]]; then
        RUNNER_IP="$(curl -fsS --retry 3 https://checkip.amazonaws.com | tr -d '[:space:]')"
    fi
    [[ "$RUNNER_IP" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || { echo "IP du runner invalide : $RUNNER_IP" >&2; exit 1; }
    echo "$RUNNER_IP"
}

case "$action" in
    open)
        ip="$(runner_ip)"
        echo "Ouverture temporaire de SSH pour ${ip}/32 dans ${sg} (${desc})"
        if aws ec2 authorize-security-group-ingress --group-id "$sg" \
            --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${ip}/32,Description=${desc}}]" \
            >/dev/null 2>"${RUNNER_TEMP:-/tmp}/sg.err"; then
            opened=1
        elif grep -q 'InvalidPermission.Duplicate' "${RUNNER_TEMP:-/tmp}/sg.err"; then
            # Règle déjà présente (ex. ADMIN_SSH_CIDR = IP du runner) : ne pas la retirer ensuite
            echo "Règle déjà présente : elle sera conservée."
            opened=0
        else
            cat "${RUNNER_TEMP:-/tmp}/sg.err" >&2
            exit 1
        fi
        if [[ -n "${GITHUB_ENV:-}" ]]; then
            echo "RUNNER_IP=${ip}" >> "$GITHUB_ENV"
            echo "SSH_RULE_OPENED=${opened}" >> "$GITHUB_ENV"
        fi
        ;;
    close)
        if [[ "${SSH_RULE_OPENED:-0}" != "1" ]]; then
            echo "Aucune règle temporaire à retirer."
            exit 0
        fi
        ip="$(runner_ip)"
        aws ec2 revoke-security-group-ingress --group-id "$sg" \
            --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${ip}/32}]" >/dev/null
        echo "SSH refermé pour ${ip}/32."
        ;;
    purge)
        ids="$(aws ec2 describe-security-group-rules --filters "Name=group-id,Values=${sg}" \
            --query "SecurityGroupRules[?IsEgress==\`false\` && starts_with(Description || '', 'gha-')].SecurityGroupRuleId" \
            --output text)"
        if [[ -z "$ids" || "$ids" == "None" ]]; then
            echo "Aucune règle temporaire gha-* dans ${sg}."
        else
            # shellcheck disable=SC2086  # liste d'identifiants séparés par des espaces
            aws ec2 revoke-security-group-ingress --group-id "$sg" --security-group-rule-ids $ids >/dev/null
            echo "Règles temporaires retirées : ${ids}"
        fi
        ;;
    *)
        echo "Action inconnue : $action" >&2
        exit 2
        ;;
esac
