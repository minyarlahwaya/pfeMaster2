#!/usr/bin/env bash
# Affiche la phrase secrète GPG des sauvegardes gérées par le pipeline.
#
#   1. secret DB_BACKUP_PASSPHRASE s'il existe ;
#   2. sinon, clé DÉRIVÉE de la clé SSH privée du pipeline (secret SSH_PRIVATE_KEY) :
#      SHA-256 de sa signature d'un message fixe. Les signatures Ed25519 et RSA
#      PKCS#1 v1.5 (ssh-keygen -Y sign) sont déterministes : la même clé redonne
#      toujours la même phrase secrète, sans aucun secret supplémentaire à stocker.
#      Qui possède la clé SSH peut déchiffrer (mêmes droits que se connecter au serveur).
#
# Usage : backup-key.sh [CLE_PRIVEE]   (défaut ~/.ssh/id_ec2)
# Déchiffrer à la main une sauvegarde S3 sur le poste d'administration :
#   .github/scripts/backup-key.sh ~/.ssh/labsuser.pem | gpg --batch --pinentry-mode loopback \
#       --passphrase-fd 0 -o landolsi.dump -d landolsi_tires_latest.dump.gpg

set -euo pipefail

if [[ -n "${DB_BACKUP_PASSPHRASE:-}" ]]; then
    printf '%s' "$DB_BACKUP_PASSPHRASE"
    exit 0
fi

key="${1:-$HOME/.ssh/id_ec2}"
[[ -r "$key" ]] || { echo "clé privée illisible : $key" >&2; exit 1; }
case "$(ssh-keygen -lf "$key" 2>/dev/null | awk '{print $NF}')" in
    "(ED25519)"|"(RSA)") ;;
    *) echo "clé $key : Ed25519 ou RSA requise (signature déterministe)" >&2; exit 1 ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
printf 'landolsi-tires-backup-v1' > "$work/msg"
ssh-keygen -q -Y sign -f "$key" -n landolsi-backup "$work/msg" >/dev/null 2>&1
sed '1d;$d' "$work/msg.sig" | tr -d '\n' | base64 -d | sha256sum | cut -d' ' -f1 | tr -d '\n'
