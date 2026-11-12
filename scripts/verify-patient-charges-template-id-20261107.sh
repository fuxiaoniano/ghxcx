#!/usr/bin/env bash
set -euo pipefail
cd /opt/wechat-appointment
sleep 5
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/arrival-patients)" = 401
docker compose exec -T server npx prisma migrate status
sudo -n nginx -t
docker inspect -f '{{.Config.Image}} {{.State.Status}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1
if docker logs --since 2m wechat-appointment-server-1 2>&1 | grep -E 'ERROR|Cannot read properties|Unhandled'; then exit 1; fi
