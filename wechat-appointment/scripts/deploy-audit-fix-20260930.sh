#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/wechat-appointment
ADMIN_ROOT=/var/www/fxnadmin
WEB_ROOT=/var/www/website
PACKAGE=/tmp/audit-fix-deploy-20260930.tar.gz
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT="$APP_ROOT/deploy-backups/audit-fix-$STAMP"
test "$(readlink -f "$APP_ROOT")" = /opt/wechat-appointment
test "$(readlink -f "$ADMIN_ROOT")" = /var/www/fxnadmin
test "$(readlink -f "$WEB_ROOT")" = /var/www/website
test -s "$PACKAGE"

tar -tzf "$PACKAGE" > /tmp/audit-fix-deploy-20260930.list
grep -qx 'server/src/main.ts' /tmp/audit-fix-deploy-20260930.list
grep -qx 'admin/dist/index.html' /tmp/audit-fix-deploy-20260930.list
grep -qx 'website/dist/index.html' /tmp/audit-fix-deploy-20260930.list

mkdir -p "$BACKUP_ROOT"
sudo tar -czf "$BACKUP_ROOT/static-sites.tar.gz" -C /var/www fxnadmin website
tar -czf "$BACKUP_ROOT/server-source.tar.gz" -C "$APP_ROOT" \
  server/src server/prisma server/package.json server/Dockerfile \
  server/tsconfig.json server/tsconfig.build.json server/nest-cli.json docker-compose.yml

cd "$APP_ROOT"
docker compose exec -T mysql sh -eu -c \
  'exec mysqldump --no-tablespaces -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  > "$BACKUP_ROOT/database.sql"
test -s "$BACKUP_ROOT/database.sql"

sudo tar --no-same-owner -xzf "$PACKAGE" -C "$APP_ROOT"
NPM_REGISTRY=https://registry.npmmirror.com docker compose up -d --build server

healthy=0
for attempt in 1 2 3 4 5 6 7 8; do
  if curl -fsS http://127.0.0.1:3000/api/website/bootstrap >/dev/null; then
    healthy=1
    break
  fi
  sleep 3
done
if test "$healthy" != 1; then
  docker compose logs --tail=160 server
  exit 1
fi

if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete "$APP_ROOT/admin/dist/" "$ADMIN_ROOT/"
  sudo rsync -a --delete "$APP_ROOT/website/dist/" "$WEB_ROOT/"
else
  sudo cp -a "$APP_ROOT/admin/dist/." "$ADMIN_ROOT/"
  sudo cp -a "$APP_ROOT/website/dist/." "$WEB_ROOT/"
fi
sudo chown -R www-data:www-data "$ADMIN_ROOT" "$WEB_ROOT"
sudo nginx -t
sudo systemctl reload nginx

printf 'DEPLOY_OK backup=%s\n' "$BACKUP_ROOT"
docker compose ps
