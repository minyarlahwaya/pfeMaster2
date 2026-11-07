#!/usr/bin/env bash
# Prépare un serveur Ubuntu neuf (22.04 / 24.04, ex. AWS EC2) pour LANDOLSI TIRES.
# Idempotent : peut être relancé sans danger. Ne supprime aucune donnée.
#
# Usage (root) :
#   sudo scripts/install.sh [--external-db] [--pg-client-version N]
#                           [--domain example.com --email admin@example.com]
#                           [--node-major 22] [--no-firewall]
#
#   --external-db          ne pas installer PostgreSQL localement (Supabase, RDS...) :
#                          renseigner ensuite DB_* et DB_SSL=true dans /etc/landolsi/backend.env
#   --pg-client-version N  installer postgresql-client-N depuis apt.postgresql.org
#                          (nécessaire si la base distante est plus récente que le client Ubuntu)
#   --domain / --email     obtenir un certificat Let's Encrypt (certbot) et activer HTTPS
#                          (--email facultatif ; sans domaine acheté : <nom>-<IP-avec-tirets>.sslip.io)
#   --node-major N         version majeure de Node.js (défaut 22, LTS)
#   --no-firewall          ne pas configurer ufw
#
# Étape suivante : sudo scripts/deploy.sh

. "$(dirname "$(readlink -f "$0")")/lib/common.sh"

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
LOCAL_DB=1
PG_CLIENT_VERSION=""
DOMAIN=""
EMAIL=""
NODE_MAJOR=22
FIREWALL=1

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --external-db)       LOCAL_DB=0; shift ;;
        --pg-client-version) PG_CLIENT_VERSION="${2:-}"; shift 2 ;;
        --domain)            DOMAIN="${2:-}"; shift 2 ;;
        --email)             EMAIL="${2:-}"; shift 2 ;;
        --node-major)        NODE_MAJOR="${2:-}"; shift 2 ;;
        --no-firewall)       FIREWALL=0; shift ;;
        -h|--help)           usage ;;
        *) echo "Argument inconnu : $1" >&2; usage ;;
    esac
done

[[ $EUID -eq 0 ]] || die "à exécuter en root (sudo)"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || die "--node-major invalide" 2
[[ -z "$PG_CLIENT_VERSION" || "$PG_CLIENT_VERSION" =~ ^[0-9]+$ ]] || die "--pg-client-version invalide" 2
if [[ -n "$EMAIL" && -z "$DOMAIN" ]]; then die "--email nécessite --domain" 2; fi

# Base déjà configurée sur un hôte distant (Supabase, via scripts/configure-db.sh) :
# mode --external-db automatique, pour qu'une réinstallation ne la remplace jamais
# par un PostgreSQL local.
if (( LOCAL_DB )) && [[ -r "$APP_ENV_FILE" ]]; then
    existing_host="$(sed -n 's/^DB_HOST=//p' "$APP_ENV_FILE" | tail -1 | tr -d "\"' ")"
    case "$existing_host" in
        ""|localhost|127.0.0.1|::1) ;;
        *) log "Base externe détectée ($existing_host) : PostgreSQL local non installé."; LOCAL_DB=0 ;;
    esac
fi

. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "système non pris en charge : ${PRETTY_NAME:-inconnu} (Ubuntu requis)"
case "${VERSION_ID:-}" in
    22.04|24.04) ;;
    *) warn "Ubuntu ${VERSION_ID} non testé (22.04 / 24.04 recommandés)" ;;
esac

export DEBIAN_FRONTEND=noninteractive

# -----------------------------------------------------
# 1. Paquets système
# -----------------------------------------------------
log "Installation des paquets système..."
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg rsync git nginx ufw openssl

# -----------------------------------------------------
# 2. Node.js (dépôt officiel NodeSource, clé GPG vérifiée par apt)
# -----------------------------------------------------
current_major="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ "$current_major" != "$NODE_MAJOR" ]]; then
    log "Installation de Node.js ${NODE_MAJOR}.x..."
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list
    apt-get update -q
    apt-get install -y -q nodejs
fi
log "Node.js $(node -v), npm $(npm -v)"

# -----------------------------------------------------
# 3. PostgreSQL (serveur local ou client seul)
# -----------------------------------------------------
if [[ -n "$PG_CLIENT_VERSION" ]]; then
    log "Ajout du dépôt apt.postgresql.org pour postgresql-client-${PG_CLIENT_VERSION}..."
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor --yes -o /etc/apt/keyrings/postgresql.gpg
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -q
    apt-get install -y -q "postgresql-client-${PG_CLIENT_VERSION}"
fi

if (( LOCAL_DB )); then
    log "Installation du serveur PostgreSQL local..."
    apt-get install -y -q postgresql postgresql-contrib
    systemctl enable --now postgresql
else
    [[ -n "$PG_CLIENT_VERSION" ]] || apt-get install -y -q postgresql-client
fi

# -----------------------------------------------------
# 4. Utilisateur système et répertoires
# -----------------------------------------------------
if ! id -u landolsi >/dev/null 2>&1; then
    log "Création de l'utilisateur système 'landolsi'..."
    useradd --system --home-dir "$APP_ROOT" --shell /usr/sbin/nologin landolsi
fi

install -d -m 0755 -o root -g root "$APP_ROOT" "$APP_ROOT/releases"
install -d -m 0750 -o landolsi -g landolsi /var/lib/landolsi /var/lib/landolsi/uploads
install -d -m 0700 -o landolsi -g landolsi "$BACKUP_DIR"
install -d -m 0750 -o root -g landolsi /etc/landolsi
# Nginx (www-data) doit pouvoir lire les images téléversées
chmod 0755 /var/lib/landolsi /var/lib/landolsi/uploads

# -----------------------------------------------------
# 5. Fichier d'environnement (secrets) : créé une seule fois
# -----------------------------------------------------
set_env() {
    local key="$1" value="$2" file="$APP_ENV_FILE"
    if grep -qE "^${key}=" "$file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
}

if [[ ! -f "$APP_ENV_FILE" ]]; then
    log "Création de $APP_ENV_FILE..."
    install -m 0640 -o root -g landolsi "$REPO_DIR/backend/.env.example" "$APP_ENV_FILE"
    set_env NODE_ENV production
    set_env HOST 127.0.0.1
    set_env PORT 5001
    set_env TRUST_PROXY true
    set_env JWT_SECRET "$(openssl rand -hex 32)"
    # Chiffrement des secrets de double authentification (fichier neuf
    # uniquement : la changer rendrait illisibles les secrets déjà enrôlés)
    set_env MFA_ENCRYPTION_KEY "$(openssl rand -hex 32)"
    set_env DB_SYNC none
    set_env UPLOAD_DIR /var/lib/landolsi/uploads
    if [[ -n "$DOMAIN" ]]; then
        set_env COOKIE_SECURE true
        set_env CORS_ORIGINS "https://${DOMAIN}"
    else
        # Sans nom de domaine (cas AWS Academy) : HTTP uniquement
        set_env COOKIE_SECURE false
        set_env CORS_ORIGINS ""
    fi
    NEW_ENV=1
else
    log "$APP_ENV_FILE existe déjà : conservé."
    NEW_ENV=0
fi

# -----------------------------------------------------
# 6. Base locale : rôle et base dédiés (moindre privilège)
# -----------------------------------------------------
if (( LOCAL_DB )); then
    load_env_file "$APP_ENV_FILE" '^DB_'
    DB_NAME="${DB_NAME:-landolsi_tires}"
    DB_USER="${DB_USER:-landolsi}"
    # Valeurs Supabase de .env.example (postgres / postgres.<project-ref>) : base locale dédiée
    [[ "$DB_USER" =~ ^[a-z_][a-z0-9_]*$ && "$DB_USER" != postgres ]] || DB_USER=landolsi
    [[ "$DB_NAME" != postgres ]] || DB_NAME=landolsi_tires
    [[ "$DB_NAME" =~ ^[a-z_][a-z0-9_]*$ && "$DB_USER" =~ ^[a-z_][a-z0-9_]*$ ]] \
        || die "DB_NAME/DB_USER doivent être en minuscules [a-z0-9_]"

    role_exists="$(runuser -u postgres -- psql -XAtc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
    if [[ "$role_exists" != "1" ]]; then
        log "Création du rôle PostgreSQL '${DB_USER}'..."
        DB_PASSWORD="$(openssl rand -hex 24)"
        runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 \
            -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
        set_env DB_PASSWORD "$DB_PASSWORD"
    elif [[ -z "${DB_PASSWORD:-}" ]]; then
        die "le rôle '${DB_USER}' existe mais DB_PASSWORD est vide dans $APP_ENV_FILE : renseignez-le (ou ALTER ROLE) puis relancez"
    fi

    db_exists="$(runuser -u postgres -- psql -XAtc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
    if [[ "$db_exists" != "1" ]]; then
        log "Création de la base '${DB_NAME}'..."
        runuser -u postgres -- createdb --owner="$DB_USER" --encoding=UTF8 "$DB_NAME"
    fi
    set_env DB_NAME "$DB_NAME"
    set_env DB_USER "$DB_USER"
    set_env DB_HOST 127.0.0.1
    set_env DB_PORT 5432
    set_env DB_SSL false
    # PostgreSQL Ubuntu écoute uniquement sur localhost par défaut : ne pas l'exposer.
fi

# -----------------------------------------------------
# 7. Swap (t3.micro / t2.micro : 1 Go de RAM, le build Vite peut manquer de mémoire)
# -----------------------------------------------------
mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if (( mem_mb < 2048 )) && ! swapon --show | grep -q .; then
    log "RAM ${mem_mb} Mo : création d'un fichier d'échange de 2 Go..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# -----------------------------------------------------
# 8. systemd
# -----------------------------------------------------
log "Installation des unités systemd..."
install -m 0644 "$REPO_DIR/systemd/landolsi-backend.service" /etc/systemd/system/
install -m 0644 "$REPO_DIR/systemd/landolsi-backup.service" /etc/systemd/system/
install -m 0644 "$REPO_DIR/systemd/landolsi-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable landolsi-backend.service >/dev/null
systemctl enable --now landolsi-backup.timer >/dev/null

# -----------------------------------------------------
# 9. Nginx
# -----------------------------------------------------
log "Configuration de Nginx..."
install -m 0644 "$REPO_DIR/nginx/security-headers.conf" /etc/nginx/snippets/landolsi-security-headers.conf
install -m 0644 "$REPO_DIR/nginx/landolsi.conf" /etc/nginx/sites-available/landolsi
ln -sfn /etc/nginx/sites-available/landolsi /etc/nginx/sites-enabled/landolsi
rm -f /etc/nginx/sites-enabled/default   # lien symbolique uniquement; le fichier d'origine reste dans sites-available
nginx -t
systemctl enable nginx >/dev/null
systemctl reload nginx || systemctl restart nginx

# -----------------------------------------------------
# 10. Pare-feu hôte (en complément du Security Group AWS)
# -----------------------------------------------------
if (( FIREWALL )); then
    log "Configuration de ufw (SSH, HTTP, HTTPS)..."
    ufw allow OpenSSH >/dev/null
    ufw allow 'Nginx Full' >/dev/null
    ufw --force enable >/dev/null
fi

# -----------------------------------------------------
# 11. HTTPS (facultatif, nécessite un nom de domaine pointant vers l'instance)
# -----------------------------------------------------
if [[ -n "$DOMAIN" ]]; then
    log "Obtention du certificat TLS pour ${DOMAIN}..."
    apt-get install -y -q certbot python3-certbot-nginx
    sed -i "s/server_name _;/server_name ${DOMAIN};/" /etc/nginx/sites-available/landolsi
    if [[ -n "$EMAIL" ]]; then CERTBOT_ACCOUNT=(-m "$EMAIL"); else CERTBOT_ACCOUNT=(--register-unsafely-without-email); fi
    certbot --nginx --non-interactive --agree-tos "${CERTBOT_ACCOUNT[@]}" -d "$DOMAIN" --redirect
    # certbot répond 404 aux requêtes HTTP sans ce nom (accès par IP) : rediriger vers le site
    sed -i "s|return 404; # managed by Certbot|return 301 https://${DOMAIN}\$request_uri; # IP nue -> domaine|" \
        /etc/nginx/sites-available/landolsi
    nginx -t && systemctl reload nginx
    # Fichier d'environnement déjà existant (installation initiale sans domaine)
    set_env COOKIE_SECURE true
    set_env CORS_ORIGINS "https://${DOMAIN}"
    systemctl try-restart landolsi-backend
fi

log "Installation terminée."
if (( NEW_ENV )); then
    log "Complétez les secrets facultatifs (SMTP, Gemini, Telegram, ADMIN_*) dans $APP_ENV_FILE :"
    log "  sudo nano $APP_ENV_FILE"
fi
(( LOCAL_DB )) || log "Base externe : renseignez DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL=true dans $APP_ENV_FILE"
log "Étape suivante : sudo $REPO_DIR/scripts/deploy.sh"
