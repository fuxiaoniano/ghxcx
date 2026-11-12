#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/wechat-appointment
ADMIN_ROOT=/var/www/fxnadmin
PACKAGE=/tmp/consultation-promotion-link-20260930.tar.gz
PACKAGE_SHA=4e585c4dbe758a6db4845ddb541ce236daa5152e2ffdc61709549af058f5158f

test "$(readlink -f "$APP_ROOT")" = /opt/wechat-appointment
test "$(readlink -f "$ADMIN_ROOT")" = /var/www/fxnadmin
test "$(sha256sum "$PACKAGE" | awk '{print $1}')" = "$PACKAGE_SHA"

echo '--- clean stale admin build assets ---'
STAGE=$(mktemp -d)
trap 'rm -rf -- "$STAGE"' EXIT
tar -xzf "$PACKAGE" -C "$STAGE" admin/dist
test -s "$STAGE/admin/dist/index.html"
grep -R -q '选择推广账户' "$STAGE/admin/dist/assets"
sudo rsync -a --delete "$STAGE/admin/dist/" "$APP_ROOT/admin/dist/"
sudo rsync -a --delete "$STAGE/admin/dist/" "$ADMIN_ROOT/"
sudo chown -R www-data:www-data "$ADMIN_ROOT"

echo '--- remove deployment and historical backups ---'
for backup_root in "$APP_ROOT/backups" "$APP_ROOT/deploy-backups"; do
  test "$(readlink -f "$backup_root")" = "$backup_root"
  sudo find "$backup_root" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
done

find "$APP_ROOT" -mindepth 1 -maxdepth 1 -type d \( -name 'server.pre-*' -o -name 'server.failed-*' \) -print0 |
  while IFS= read -r -d '' old_server; do
    case "$old_server" in
      "$APP_ROOT"/server.pre-*|"$APP_ROOT"/server.failed-*) sudo rm -rf -- "$old_server" ;;
      *) echo "Refusing unexpected path: $old_server" >&2; exit 1 ;;
    esac
  done

sudo find "$APP_ROOT" -mindepth 1 -maxdepth 1 -type f -name '.env.pre-*' -delete
if test -d "$APP_ROOT/node_modules"; then
  test "$(readlink -f "$APP_ROOT/node_modules")" = "$APP_ROOT/node_modules"
  sudo rm -rf -- "$APP_ROOT/node_modules"
fi

echo '--- remove temporary deployment artifacts ---'
find /tmp -maxdepth 1 -type f \( -name 'audit-fix-deploy-*.tar.gz' -o -name 'consultation-promotion-link-*.tar.gz' -o -name 'deploy-audit-fix-*.sh' -o -name 'deploy-consultation-promotion-link-*.sh' -o -name 'verify-consultation-promotion-link-*.sh' -o -name 'audit-fix-deploy-*.list' -o -name 'consultation-promotion-link-*.list' \) -delete

echo '--- prune unused Docker resources, preserving running containers and volumes ---'
docker container prune -f
docker image prune -a -f
docker builder prune -a -f

echo '--- clean package caches and old journal segments ---'
sudo apt-get clean
test "$(readlink -f /var/lib/apt/lists)" = /var/lib/apt/lists
sudo find /var/lib/apt/lists -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo journalctl --vacuum-size=120M

sudo nginx -t
sudo systemctl reload nginx

echo '--- post-clean verification ---'
cd "$APP_ROOT"
docker compose ps
curl -fsS http://127.0.0.1:3000/api/website/bootstrap >/dev/null
curl -fsS https://wechatadmin.fuxiaonian.net/ >/dev/null
curl -fsS https://wechat.fuxiaonian.net/ >/dev/null
df -h /
docker system df
du -sh "$APP_ROOT" "$ADMIN_ROOT" /var/log /var/cache/apt /var/lib/apt/lists 2>/dev/null || true
