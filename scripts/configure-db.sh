#!/usr/bin/env bash
# Configure la connexion à la base PostgreSQL managée (Supabase) dans
# /etc/landolsi/backend.env : plus de PostgreSQL local, plus de restauration.
# Les paramètres sont lus sur l'ENTRÉE STANDARD (lignes DB_HOST=..., DB_PORT=...,
# DB_NAME=..., DB_USER=..., DB_PASSWORD=...) : ils n'apparaissent ni dans la
# ligne de commande, ni dans Git.
#
# Usage (root) :
#   sudo scripts/configure-db.sh [--no-restart] < fichier_avec_les_lignes_DB_
#
# Depuis le poste d'administration (paramètres dans backend/.env local) :
#   grep -E '^DB_(HOST|PORT|NAME|USER|PASSWORD)=' backend/.env | \
#     ssh ubuntu@<IP> 'sudo /opt/landolsi-src/scripts/configure-db.sh'
#
# Le certificat racine Supabase (backend/certs/prod-ca-2021.crt) est copié dans
# /etc/landolsi/supabase-ca.crt : TLS vérifié (DB_SSL_REJECT_UNAUTHORIZED=true).
# La connexion est testée avant toute modification du fichier d'environnement.

. "$(dirname "$(readlink -f "$0")")/lib/common.sh"

RESTART=1
case "${1:-}" in
    --no-restart) RESTART=0 ;;
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
    "") ;;
    *) echo "Argument inconnu : $1" >&2; exit 2 ;;
esac

[[ $EUID -eq 0 ]] || die "à exécuter en root (sudo)" 2
[[ -w "$APP_ENV_FILE" ]] || die "$APP_ENV_FILE absent : lancez d'abord scripts/install.sh"
[[ -t 0 ]] && die "fournissez les lignes DB_HOST=... DB_PASSWORD=... sur l'entrée standard (voir --help)" 2

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
CA_SRC="$REPO_DIR/backend/certs/prod-ca-2021.crt"
CA_DST=/etc/landolsi/supabase-ca.crt

H="" P="5432" N="postgres" U="" W=""
while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    case "$line" in
        DB_HOST=*)     H="${line#DB_HOST=}" ;;
        DB_PORT=*)     P="${line#DB_PORT=}" ;;
        DB_NAME=*)     N="${line#DB_NAME=}" ;;
        DB_USER=*)     U="${line#DB_USER=}" ;;
        DB_PASSWORD=*) W="${line#DB_PASSWORD=}" ;;
    esac
done
[[ "$H" =~ ^[A-Za-z0-9.-]+$ ]] || die "DB_HOST absent ou invalide" 2
[[ "$P" =~ ^[0-9]+$ ]] || die "DB_PORT invalide" 2
[[ "$N" =~ ^[A-Za-z0-9_.-]+$ ]] || die "DB_NAME invalide" 2
[[ "$U" =~ ^[A-Za-z0-9_.-]+$ ]] || die "DB_USER absent ou invalide" 2
[[ -n "$W" ]] || die "DB_PASSWORD absent" 2
[[ -r "$CA_SRC" ]] || die "certificat Supabase introuvable : $CA_SRC"

install -m 0644 -o root -g root "$CA_SRC" "$CA_DST"

# Test de connexion (TLS vérifié) avant d'écrire quoi que ce soit
if command -v psql >/dev/null 2>&1; then
    if ! PGPASSWORD="$W" psql -XAt "host=$H port=$P dbname=$N user=$U sslmode=verify-full sslrootcert=$CA_DST connect_timeout=15" \
            -c 'SELECT 1' >/dev/null; then
        die "connexion à $H:$P impossible (hôte, identifiants ou réseau ; Supabase direct = IPv6 seulement, utiliser le session pooler)"
    fi
    log "Connexion à $H:$P/$N vérifiée (TLS, certificat Supabase)."
else
    warn "psql absent : connexion non testée"
fi

set_env() {
    local key="$1" value="$2" tmp
    tmp="$(mktemp)"
    grep -vE "^${key}=" "$APP_ENV_FILE" > "$tmp" || true
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    cat "$tmp" > "$APP_ENV_FILE"   # conserve propriétaire et droits
    rm -f "$tmp"
}
set_env DB_HOST "$H"
set_env DB_PORT "$P"
set_env DB_NAME "$N"
set_env DB_USER "$U"
set_env DB_PASSWORD "$W"
set_env DB_SSL true
set_env DB_SSL_REJECT_UNAUTHORIZED true
set_env DB_SSL_CA_PATH "$CA_DST"
set_env DB_SYNC none
unset W
log "Paramètres de la base externe enregistrés dans $APP_ENV_FILE."

# Le PostgreSQL local d'une ancienne installation n'est plus utilisé
if systemctl is-active --quiet postgresql 2>/dev/null; then
    systemctl disable --now postgresql >/dev/null 2>&1 || true
    log "PostgreSQL local arrêté et désactivé (base désormais externe)."
fi

if (( RESTART )) && systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1 \
        && [[ -e "${APP_ROOT:-/opt/landolsi}/current" ]]; then
    systemctl restart "$SERVICE_NAME"
    log "$SERVICE_NAME redémarré."
fi
