#!/usr/bin/env bash
set -euo pipefail

APP=/opt/wechat-appointment
RELEASE=/tmp/wechat-callback-ui-20261107
IMAGE=wechat-appointment-server:callback-ui-20261107
BASE_IMAGE=wechat-appointment-server:prelaunch-final2-20261106
BACKUP="$APP/server-backups/callback-ui-20261107"

mkdir -p "$BACKUP"
cp "$APP/docker-compose.yml" "$BACKUP/docker-compose.yml"

docker build --memory=384m --cpu-period=100000 --cpu-quota=50000 \
  --build-arg BASE_IMAGE="$BASE_IMAGE" \
  -f "$RELEASE/scripts/Dockerfile.runtime-deploy" -t "$IMAGE" "$RELEASE"

cd "$APP"
docker compose exec -T server npx prisma migrate status
sed -i "s#image: wechat-appointment-server:.*#image: $IMAGE#" docker-compose.yml

sudo -n rm -rf /var/www/fxnadmin.next /var/www/fxnadmin.rollback
sudo -n cp -a "$RELEASE/admin/dist" /var/www/fxnadmin.next
sudo -n mv /var/www/fxnadmin /var/www/fxnadmin.rollback
sudo -n mv /var/www/fxnadmin.next /var/www/fxnadmin

docker compose up -d --no-deps server
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/ >/dev/null; then break; fi
  sleep 2
done

curl -fsS http://127.0.0.1:3000/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/consultations/callbacks/today)" = 401
docker compose exec -T server npx prisma migrate status
sudo -n nginx -t

cp "$RELEASE/AGENTS.md" "$APP/AGENTS.md"
sha256sum "$RELEASE/admin/dist/index.html" /var/www/fxnadmin/index.html
docker inspect -f '{{.Config.Image}} {{.State.Status}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1

rm -rf "$RELEASE"
rm -f /tmp/wechat-callback-ui-20261107.tar.gz
