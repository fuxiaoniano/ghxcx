#!/usr/bin/env bash
set -euo pipefail
APP=/opt/wechat-appointment
RELEASE=/tmp/wechat-patient-charges-template-id-20261107
IMAGE=wechat-appointment-server:patient-charges-template-id-20261107
BASE_IMAGE=wechat-appointment-server:patient-charges-account-match-20261107
BACKUP="$APP/server-backups/patient-charges-template-id-20261107"
mkdir -p "$BACKUP"
cp "$APP/docker-compose.yml" "$BACKUP/docker-compose.yml"
cd "$APP"
nice -n 15 docker compose exec -T mysql sh -lc 'mysqldump --single-transaction --quick -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > "$BACKUP/database.sql"
test -s "$BACKUP/database.sql"
nice -n 15 docker build --memory=384m --cpu-period=100000 --cpu-quota=50000 --build-arg BASE_IMAGE="$BASE_IMAGE" -f "$RELEASE/scripts/Dockerfile.runtime-deploy" -t "$IMAGE" "$RELEASE"
sed -i "s#image: wechat-appointment-server:.*#image: $IMAGE#" "$APP/docker-compose.yml"
nice -n 15 docker compose run --rm --no-deps server npx prisma migrate deploy
sudo -n rm -rf /var/www/fxnadmin.next /var/www/fxnadmin.rollback
sudo -n cp -a "$RELEASE/admin/dist" /var/www/fxnadmin.next
sudo -n mv /var/www/fxnadmin /var/www/fxnadmin.rollback
sudo -n mv /var/www/fxnadmin.next /var/www/fxnadmin
docker compose up -d --no-deps server
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/ >/dev/null && break || true; sleep 2; done
curl -fsS http://127.0.0.1:3000/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/arrival-patients)" = 401
docker compose exec -T server npx prisma migrate status
sudo -n nginx -t
cp "$RELEASE/AGENTS.md" "$APP/AGENTS.md"
docker inspect -f '{{.Config.Image}} {{.State.Status}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1
rm -rf "$RELEASE"
rm -f /tmp/wechat-patient-charges-template-id-20261107.tar.gz
