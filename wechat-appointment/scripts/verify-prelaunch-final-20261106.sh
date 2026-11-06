#!/usr/bin/env bash
set -euo pipefail
cd /opt/wechat-appointment
sleep 5
curl -fsS http://127.0.0.1:3000/ >/dev/null
admin_status=$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)
unauthorized_status=$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/accounts)
test "$admin_status" = 200
test "$unauthorized_status" = 401
docker compose exec -T server npx prisma migrate status
sudo -n nginx -t
sudo -n grep -A8 -B2 'tencent-user-token-auth/callback' /etc/nginx/sites-enabled/wechat-appointment
sha256sum /var/www/fxnadmin/index.html /var/www/website/index.html AGENTS.md
test -z "$(find /var/www/website -name '*.map' -print -quit)"
docker inspect -f '{{.Config.Image}} {{.State.Status}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1
if docker logs --since 30s wechat-appointment-server-1 2>&1 | grep -E 'ERROR|Cannot read properties|Unhandled'; then
  exit 1
fi
rm -f /tmp/.deploy-final-20261106.tar.gz
rm -rf /tmp/wechat-prelaunch-final-20261106
