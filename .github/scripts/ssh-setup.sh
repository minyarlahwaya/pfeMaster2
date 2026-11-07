#!/usr/bin/env bash
# Prépare la connexion SSH du runner vers l'instance EC2 et crée l'alias « ec2 »
# (ssh ec2 '...', scp fichier ec2:/tmp/).
#
#   1. écrit la clé privée (secret SSH_PRIVATE_KEY) avec les droits 600 ;
#   2. attend l'ouverture du port 22 ;
#   3. récupère la clé d'hôte ED25519 du serveur et, si possible, la compare à
#      l'empreinte publiée par cloud-init dans la console série de l'instance
#      (canal AWS authentifié) : protection contre l'interception (MITM) au
#      lieu d'un simple « trust on first use » ;
#   4. attend que la connexion SSH soit acceptée (cloud-init installe la clé).
#
# Variables : EC2_HOST (IP), SSH_PRIVATE_KEY, INSTANCE_ID (facultatif, pour la
# vérification de l'empreinte), SSH_USER (défaut ubuntu).

set -euo pipefail

: "${EC2_HOST:?EC2_HOST requis}"
: "${SSH_PRIVATE_KEY:?secret SSH_PRIVATE_KEY absent}"
SSH_USER="${SSH_USER:-ubuntu}"

install -m 700 -d ~/.ssh
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > ~/.ssh/id_ec2
chmod 600 ~/.ssh/id_ec2
if ! ssh-keygen -y -f ~/.ssh/id_ec2 > ~/.ssh/id_ec2.pub 2>/dev/null; then
    echo "::error::SSH_PRIVATE_KEY n'est pas une clé privée OpenSSH/PEM valide (ou elle est protégée par une phrase secrète)."
    exit 1
fi
echo "Clé SSH du pipeline : $(ssh-keygen -lf ~/.ssh/id_ec2.pub | awk '{print $1, $2, $NF}')"

echo "Attente du port 22 sur ${EC2_HOST}..."
for i in $(seq 1 72); do
    if nc -z -w 5 "$EC2_HOST" 22 2>/dev/null; then break; fi
    if (( i == 72 )); then echo "::error::port 22 injoignable sur ${EC2_HOST} après 6 min"; exit 1; fi
    sleep 5
done

scanned=""
for _ in $(seq 1 12); do
    scanned="$(ssh-keyscan -T 10 -t ed25519 "$EC2_HOST" 2>/dev/null | grep -v '^#' || true)"
    [[ -n "$scanned" ]] && break
    sleep 5
done
[[ -n "$scanned" ]] || { echo "::error::clé d'hôte ED25519 introuvable"; exit 1; }
scanned_fp="$(ssh-keygen -lf <(echo "$scanned") | awk '{print $2}')"

expected_fp=""
if [[ -n "${INSTANCE_ID:-}" ]]; then
    echo "Lecture de l'empreinte d'hôte dans la console série de ${INSTANCE_ID}..."
    for _ in $(seq 1 12); do
        expected_fp="$(aws ec2 get-console-output --instance-id "$INSTANCE_ID" --latest \
            --query Output --output text 2>/dev/null \
            | grep -E 'SHA256:[A-Za-z0-9+/=]+ .*\(ED25519\)' | grep -oE 'SHA256:[A-Za-z0-9+/=]+' | tail -1 || true)"
        [[ -n "$expected_fp" ]] && break
        sleep 15
    done
fi

if [[ -n "$expected_fp" ]]; then
    if [[ "$expected_fp" != "$scanned_fp" ]]; then
        echo "::error::Empreinte SSH inattendue : console AWS ${expected_fp}, serveur ${scanned_fp}. Connexion refusée."
        exit 1
    fi
    echo "Empreinte d'hôte vérifiée par la console AWS : ${scanned_fp}"
else
    echo "::warning::Empreinte absente de la console série (instance ancienne ou console pas encore disponible) : clé d'hôte acceptée à la première connexion (${scanned_fp})."
fi
echo "$scanned" > ~/.ssh/known_hosts

cat > ~/.ssh/config <<EOF
Host ec2
    HostName ${EC2_HOST}
    User ${SSH_USER}
    IdentityFile ~/.ssh/id_ec2
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking yes
    UserKnownHostsFile ~/.ssh/known_hosts
    ConnectTimeout 15
    ServerAliveInterval 30
    ServerAliveCountMax 10
EOF
chmod 600 ~/.ssh/config

echo "Attente de l'authentification SSH (clé installée par cloud-init)..."
for i in $(seq 1 30); do
    if ssh ec2 true 2>/dev/null; then echo "Connexion SSH établie."; exit 0; fi
    if (( i == 30 )); then
        ssh -v ec2 true || true
        echo "::error::authentification SSH refusée : SSH_PRIVATE_KEY doit correspondre à la clé injectée (ssh_public_key) ou à la paire vockey."
        exit 1
    fi
    sleep 10
done
