#!/usr/bin/env bash
# Déploie une nouvelle version de LANDOLSI TIRES à partir d'un répertoire source
# (clone Git sur le serveur). Chaque version est construite dans
# /opt/landolsi/releases/<id>, puis activée en basculant le lien
# /opt/landolsi/current. En cas d'échec du contrôle de santé, la version
# précédente est réactivée automatiquement.
#
# Usage (root) :
#   sudo scripts/deploy.sh [--source DIR] [--skip-backup] [--keep N] [--no-restart]
#
#   --source DIR   répertoire du dépôt (défaut : celui contenant ce script)
#   --skip-backup  ne pas sauvegarder la base avant les migrations (déconseillé)
#   --keep N       nombre de versions conservées dans releases/ (défaut 5)
#   --no-restart   construire, migrer et activer sans redémarrer les services
#                  (tests ou machine sans systemd)
#
# Interruption : le redémarrage du processus Node coupe l'API quelques secondes
# (pas de déploiement sans interruption avec une seule instance).

. "$(dirname "$(readlink -f "$0")")/lib/common.sh"

SOURCE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
SKIP_BACKUP=0
KEEP=5
RESTART=1
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5001/health}"

usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --source)      SOURCE="$(cd "${2:?}" && pwd)"; shift 2 ;;
        --skip-backup) SKIP_BACKUP=1; shift ;;
        --keep)        KEEP="${2:-}"; shift 2 ;;
        --no-restart)  RESTART=0; shift ;;
        -h|--help)     usage ;;
        *) echo "Argument inconnu : $1" >&2; usage ;;
    esac
done

[[ "$KEEP" =~ ^[0-9]+$ && "$KEEP" -ge 2 ]] || die "--keep doit être un entier >= 2" 2
[[ -f "$SOURCE/backend/package.json" && -f "$SOURCE/frontend/package.json" ]] \
    || die "dépôt LANDOLSI introuvable dans $SOURCE" 2
[[ -r "$APP_ENV_FILE" ]] || die "$APP_ENV_FILE absent : lancez d'abord scripts/install.sh"
require_cmd node npm rsync

# Exécuter les commandes applicatives avec l'utilisateur de service si root
if [[ $EUID -eq 0 ]]; then
    as_app() { runuser -u landolsi -- "$@"; }
else
    as_app() { "$@"; }
fi

load_env_file "$APP_ENV_FILE" '^(UPLOAD_DIR|DB_)'
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/landolsi/uploads}"

rev="nogit"
if git -C "$SOURCE" rev-parse --short HEAD >/dev/null 2>&1; then
    rev="$(git -C "$SOURCE" rev-parse --short HEAD)"
    [[ -z "$(git -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || rev="${rev}-dirty"
fi
RELEASE_ID="$(date -u '+%Y%m%d%H%M%S')-${rev}"
RELEASE="$APP_ROOT/releases/$RELEASE_ID"
PREVIOUS="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

log "Version : $RELEASE_ID"
[[ -n "$PREVIOUS" ]] && log "Version active : $(basename "$PREVIOUS")"

cleanup_failed_build() {
    local rc=$?
    if [[ $rc -ne 0 && -d "$RELEASE" && "$(readlink -f "$APP_ROOT/current" 2>/dev/null)" != "$RELEASE" ]]; then
        warn "échec de construction : suppression de la version incomplète $RELEASE_ID"
        rm -rf -- "$RELEASE"
    fi
}
trap cleanup_failed_build EXIT

# -----------------------------------------------------
# 1. Copie du code (sans secrets, dépendances ni historique Git)
# -----------------------------------------------------
mkdir -p "$APP_ROOT/releases"
rsync -a --delete \
    --include '.env.example' \
    --exclude '.git/' --exclude '.claude/' --exclude 'node_modules/' \
    --exclude 'frontend/dist/' --exclude '.env' --exclude '.env.*' \
    --exclude 'infra/aws/.terraform/' --exclude '*.tfstate*' --exclude 'backups/' \
    "$SOURCE/" "$RELEASE/"

# -----------------------------------------------------
# 2. Dépendances et build
# -----------------------------------------------------
log "Installation des dépendances backend (production)..."
(cd "$RELEASE/backend" && npm ci --omit=dev --no-audit --no-fund)

log "Build du frontend (VITE_API_URL=/api)..."
(cd "$RELEASE/frontend" && npm ci --no-audit --no-fund && VITE_API_URL=/api npm run build)
rm -rf "$RELEASE/frontend/node_modules"   # inutile à l'exécution
[[ -f "$RELEASE/frontend/dist/index.html" ]] || die "build frontend incomplet"

if [[ $EUID -eq 0 ]]; then
    chown -R root:root "$RELEASE"
    chmod -R go-w "$RELEASE"
fi

# -----------------------------------------------------
# 3. Images : copie initiale des images du dépôt vers le stockage persistant
#    (sans jamais écraser un fichier existant)
# -----------------------------------------------------
mkdir -p "$UPLOAD_DIR"
cp -n "$RELEASE"/backend/public/uploadPneu/* "$UPLOAD_DIR"/ 2>/dev/null || true
[[ $EUID -eq 0 ]] && chown -R landolsi:landolsi "$UPLOAD_DIR"

# -----------------------------------------------------
# 4. Sauvegarde puis migrations
# -----------------------------------------------------
case "${DB_HOST:-localhost}" in
    localhost|127.0.0.1|::1) EXTERNAL_DB=0 ;;
    *) EXTERNAL_DB=1 ;;
esac
if (( SKIP_BACKUP )); then
    warn "sauvegarde pré-migration ignorée (--skip-backup)"
elif (( EXTERNAL_DB )); then
    # Base managée (Supabase) : sauvegardes assurées par le fournisseur,
    # pas de pg_dump local (version du client différente du serveur).
    log "Base externe (${DB_HOST}) : sauvegarde pré-migration assurée par le fournisseur."
else
    log "Sauvegarde de la base avant migration..."
    as_app "$RELEASE/scripts/backup-db.sh" --env-file "$APP_ENV_FILE" --output-dir "$BACKUP_DIR" \
        || die "sauvegarde impossible : déploiement interrompu (aucune modification appliquée)"
    log "Restauration possible avec : scripts/restore-db.sh --file $(ls -1t "$BACKUP_DIR"/*.dump | head -1) --target-db <nouvelle_base> --create"
fi

log "Application des migrations..."
(cd "$RELEASE/backend" && as_app env NODE_ENV=production ENV_FILE="$APP_ENV_FILE" \
    ./node_modules/.bin/sequelize-cli db:migrate)

# -----------------------------------------------------
# 5. Activation atomique
# -----------------------------------------------------
ln -sfn "$RELEASE" "$APP_ROOT/current.tmp"
mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
log "Version activée : $RELEASE_ID"

rollback_to_previous() {
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
        warn "retour à la version précédente $(basename "$PREVIOUS")"
        ln -sfn "$PREVIOUS" "$APP_ROOT/current.tmp"
        mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
        systemctl restart "$SERVICE_NAME" || true
        systemctl reload nginx || true
        warn "les migrations déjà appliquées ne sont pas annulées; voir docs/deployment/rollback.md"
    fi
}

if (( RESTART )); then
    require_cmd systemctl curl
    log "Redémarrage de $SERVICE_NAME..."
    systemctl restart "$SERVICE_NAME"
    systemctl reload nginx

    if ! "$RELEASE/scripts/health-check.sh" --backend-url "$HEALTH_URL" --retries 20; then
        journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2 || true
        rollback_to_previous
        trap - EXIT
        die "contrôle de santé en échec pour $RELEASE_ID"
    fi
else
    warn "--no-restart : services non redémarrés"
fi

trap - EXIT

# -----------------------------------------------------
# 6. Nettoyage des anciennes versions (jamais l'active ni la précédente)
# -----------------------------------------------------
mapfile -t releases < <(ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null | sed 's#/$##')
for old in "${releases[@]:$KEEP}"; do
    [[ "$old" == "$RELEASE" || "$old" == "$PREVIOUS" ]] && continue
    log "Suppression de l'ancienne version $(basename "$old")"
    rm -rf -- "$old"
done

log "Déploiement terminé : $RELEASE_ID"
