#!/usr/bin/env bash
set -euo pipefail

app='/opt/wechat-appointment'
release='/tmp/wechat-consultation-tag-edit-20261113'
archive='/tmp/wechat-consultation-tag-edit-20261113.tar.gz'
image='wechat-appointment-server:consultation-tag-edit-20261113'
base_image='wechat-appointment-server:promotion-stat-filters-20261113'
backup="$app/server-backups/consultation-tag-edit-20261113"
compose="$app/docker-compose.yml"

test -s "$release/server/dist/src/main.js"
test -s "$release/server/src/modules/consultation/consultation.service.ts"
test -s "$release/server/test/consultation-tags.spec.ts"
test -s "$release/AGENTS.md"
test "$(docker inspect -f '{{.Config.Image}}' wechat-appointment-server-1)" = "$base_image"

mkdir -p "$backup"
cp "$compose" "$backup/docker-compose.yml"
cd "$app"

nice -n 15 docker build --memory=384m --cpu-period=100000 --cpu-quota=50000 \
  --build-arg BASE_IMAGE="$base_image" \
  -f "$release/scripts/Dockerfile.runtime-consultation-tag-edit-overlay" \
  -t "$image" "$release"

sed -i "s#image: wechat-appointment-server:.*#image: $image#" "$compose"
if ! docker compose -f "$compose" up -d --no-deps server; then
  cp "$backup/docker-compose.yml" "$compose"
  docker compose -f "$compose" up -d --no-deps server
  exit 1
fi

healthy='false'
for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    healthy='true'
    break
  fi
  sleep 2
done
if test "$healthy" != 'true'; then
  cp "$backup/docker-compose.yml" "$compose"
  docker compose -f "$compose" up -d --no-deps server
  exit 1
fi

test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = '200'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/consultations)" = '401'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://afterbeat.fuxiaonian.net/api/afterbeat/bootstrap)" = '200'
sudo -n nginx -t

install -m 0644 "$release/server/src/modules/consultation/consultation.service.ts" "$app/server/src/modules/consultation/consultation.service.ts"
install -m 0644 "$release/server/test/consultation-tags.spec.ts" "$app/server/test/consultation-tags.spec.ts"
install -m 0644 "$release/AGENTS.md" "$app/AGENTS.md"
install -m 0644 "$release/scripts/Dockerfile.runtime-consultation-tag-edit-overlay" "$app/scripts/Dockerfile.runtime-consultation-tag-edit-overlay"
install -m 0755 "$release/scripts/deploy-consultation-tag-edit-20261113.sh" "$app/scripts/deploy-consultation-tag-edit-20261113.sh"

docker image rm wechat-appointment-server:manual-arrival-counts-20261113 >/dev/null 2>&1 || true
docker image prune -f >/dev/null
docker inspect -f '{{.Config.Image}} {{.State.Status}} {{.RestartCount}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1
rm -rf -- "$release"
rm -f -- "$archive"
printf 'CONSULTATION_TAG_EDIT_DEPLOY_OK\n'
