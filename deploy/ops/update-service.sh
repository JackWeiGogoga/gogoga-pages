#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/gogoga-pages}"
SERVICE="${SERVICE:-app}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/dashboard}"

DO_PULL=1
DO_DB_PUSH=1
DO_BACKUP=1
SHOW_LOGS=0

usage() {
  cat <<'EOF'
Usage: ./update-service.sh [options]

Update the Gogoga Pages Docker Compose service.

Options:
  --no-pull      Skip docker compose pull
  --skip-db      Skip prisma db push
  --skip-backup  Skip SQLite backup before db push
  --logs         Show recent app logs after update
  -h, --help     Show help

Environment:
  APP_DIR        Default: /opt/gogoga-pages
  COMPOSE_FILE   Default: /opt/gogoga-pages/docker-compose.yml
  SERVICE        Default: app
  HEALTH_URL     Default: http://127.0.0.1:3000/dashboard
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-pull)
      DO_PULL=0
      ;;
    --skip-db)
      DO_DB_PUSH=0
      ;;
    --skip-backup)
      DO_BACKUP=0
      ;;
    --logs)
      SHOW_LOGS=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

[ -d "$APP_DIR" ] || die "APP_DIR does not exist: $APP_DIR"
[ -f "$COMPOSE_FILE" ] || die "Compose file does not exist: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "docker is not installed"

cd "$APP_DIR"

LOCK_DIR="/tmp/gogoga-pages-update.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die "another update appears to be running: $LOCK_DIR"
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

backup_sqlite() {
  local db_path="$APP_DIR/data/app.db"
  local backup_dir="$APP_DIR/backups"
  local backup_path="$backup_dir/app-$(date '+%Y%m%d-%H%M%S').db"

  if [ ! -f "$db_path" ]; then
    log "SQLite database not found at $db_path; skipping backup"
    return
  fi

  mkdir -p "$backup_dir"
  cp -p "$db_path" "$backup_path"
  log "Backed up SQLite database to $backup_path"
}

health_check() {
  if ! command -v curl >/dev/null 2>&1; then
    log "curl is not installed; skipping health check"
    return
  fi

  log "Checking health: $HEALTH_URL"
  for _ in $(seq 1 30); do
    if curl -fsS -I "$HEALTH_URL" >/dev/null 2>&1; then
      log "Health check passed"
      return
    fi
    sleep 2
  done

  die "Health check failed: $HEALTH_URL"
}

log "Using app dir: $APP_DIR"
log "Using compose file: $COMPOSE_FILE"

if [ "$DO_PULL" -eq 1 ]; then
  log "Pulling latest image for $SERVICE"
  compose pull "$SERVICE"
fi

if [ "$DO_DB_PUSH" -eq 1 ]; then
  if [ "$DO_BACKUP" -eq 1 ]; then
    backup_sqlite
  fi

  log "Applying Prisma schema with prisma db push"
  compose run --rm --no-deps "$SERVICE" npx prisma db push --skip-generate
else
  log "Skipping database update"
fi

log "Starting service"
compose up -d --remove-orphans "$SERVICE"

health_check
compose ps "$SERVICE"

if [ "$SHOW_LOGS" -eq 1 ]; then
  compose logs --tail=120 "$SERVICE"
fi

log "Update completed"
