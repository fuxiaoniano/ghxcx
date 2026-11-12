#!/usr/bin/env bash
set -euo pipefail

APP=/opt/wechat-appointment
RELEASE=/tmp/wechat-prelaunch-final-20261106
IMAGE=wechat-appointment-server:prelaunch-final-20261106
SITE=/etc/nginx/sites-enabled/wechat-appointment
BACKUP="$APP/server-backups/prelaunch-final-20261106"

mkdir -p "$BACKUP"
cp "$APP/docker-compose.yml" "$BACKUP/docker-compose.yml"
sudo -n cp "$SITE" "$BACKUP/nginx.conf"

cd "$APP"
nice -n 15 docker compose exec -T mysql sh -lc 'mysqldump --single-transaction --quick -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > "$BACKUP/database.sql"
test -s "$BACKUP/database.sql"

docker build --memory=384m --cpu-period=100000 --cpu-quota=50000 \
  --build-arg BASE_IMAGE=wechat-appointment-server:prelaunch-complete-20261106 \
  -f "$RELEASE/scripts/Dockerfile.runtime-deploy" -t "$IMAGE" "$RELEASE"

sed -i "s#image: wechat-appointment-server:.*#image: $IMAGE#" "$APP/docker-compose.yml"
docker compose run --rm --no-deps server npx prisma migrate deploy

sudo -n rm -rf /var/www/fxnadmin.next /var/www/website.next /var/www/fxnadmin.rollback /var/www/website.rollback
sudo -n cp -a "$RELEASE/admin/dist" /var/www/fxnadmin.next
sudo -n cp -a "$RELEASE/website/dist" /var/www/website.next
sudo -n mv /var/www/fxnadmin /var/www/fxnadmin.rollback
sudo -n mv /var/www/fxnadmin.next /var/www/fxnadmin
sudo -n mv /var/www/website /var/www/website.rollback
sudo -n mv /var/www/website.next /var/www/website

python3 - "$BACKUP/nginx.conf" /tmp/wechat-appointment.nginx.next <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1])
target = Path(sys.argv[2])
original = source.read_text(encoding='utf-8')
marker = '  server_name wechat.fuxiaonian.net;\n'
block = '''

  # Tencent returns user_token in the query string. Never write this exact callback to access logs.
  location = /api/admin/operations/tencent-user-token-auth/callback {
    access_log off;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
'''
if 'location = /api/admin/operations/tencent-user-token-auth/callback' not in original:
    if original.count(marker) < 1:
        raise SystemExit('expected public HTTPS server block not found')
    original = original.replace(marker, marker + block, 1)
target.write_text(original, encoding='utf-8')
PY
sudo -n cp /tmp/wechat-appointment.nginx.next "$SITE"

sudo -n nginx -t
sudo -n systemctl reload nginx
docker compose up -d --no-deps server

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/public/landing-page >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3000/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/accounts)" = 401
docker compose exec -T server npx prisma migrate status

cp "$RELEASE/AGENTS.md" "$APP/AGENTS.md"
sha256sum "$RELEASE/admin/dist/index.html" /var/www/fxnadmin/index.html
sha256sum "$RELEASE/website/dist/index.html" /var/www/website/index.html
docker inspect -f '{{.Config.Image}} {{.State.Status}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1

# Keep one immediately recoverable static rollback, but remove the uploaded package after verification.
rm -rf "$RELEASE"
