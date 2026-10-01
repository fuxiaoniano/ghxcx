#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/wechat-appointment
WEB_ROOT=/var/www/website
ADMIN_ROOT=/var/www/fxnadmin
PACKAGE=/tmp/deploy-oral-news-20260926.tar.gz
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT="$APP_ROOT/deploy-backups/oral-news-$STAMP"

test "$(readlink -f "$APP_ROOT")" = /opt/wechat-appointment
test "$(readlink -f "$WEB_ROOT")" = /var/www/website
test "$(readlink -f "$ADMIN_ROOT")" = /var/www/fxnadmin
test -f "$PACKAGE"

mkdir -p "$BACKUP_ROOT"
sudo tar -czf "$BACKUP_ROOT/static-sites.tar.gz" -C /var/www website fxnadmin
tar -czf "$BACKUP_ROOT/server-source.tar.gz" -C "$APP_ROOT" server/src server/prisma server/package.json server/Dockerfile server/tsconfig.json server/tsconfig.build.json server/nest-cli.json
if test -d "$APP_ROOT/scripts"; then
  tar -czf "$BACKUP_ROOT/automation-scripts.tar.gz" -C "$APP_ROOT" scripts
fi

cd "$APP_ROOT"
docker compose exec -T mysql sh -c 'exec mysqldump --no-tablespaces -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > "$BACKUP_ROOT/database.sql"
test -s "$BACKUP_ROOT/database.sql"
sudo tar --no-same-owner -xzf "$PACKAGE" -C "$APP_ROOT"

docker compose up -d --build server

sudo find "$WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo find "$ADMIN_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo cp -a "$APP_ROOT/website/dist/." "$WEB_ROOT/"
sudo cp -a "$APP_ROOT/admin/dist/." "$ADMIN_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT" "$ADMIN_ROOT"
sudo nginx -t
sudo systemctl reload nginx

for attempt in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:3000/api/website/bootstrap >/dev/null; then
    printf 'DEPLOY_OK backup=%s\n' "$BACKUP_ROOT"
    exit 0
  fi
  sleep 3
done

docker compose logs --tail=120 server
exit 1
