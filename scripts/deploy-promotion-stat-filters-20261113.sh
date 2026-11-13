#!/usr/bin/env bash
set -euo pipefail

app='/opt/wechat-appointment'
release='/tmp/wechat-promotion-stat-filters-20261113'
image='wechat-appointment-server:promotion-stat-filters-20261113'
base_image='wechat-appointment-server:manual-arrival-counts-20261113'
backup="$app/server-backups/promotion-stat-filters-20261113"
compose="$app/docker-compose.yml"

test -s "$release/server/dist/src/main.js"
test -s "$release/server/prisma/migrations/20261113000100_clear_manual_promotion_revenue/migration.sql"
test -s "$release/admin/dist/index.html"
test "$(docker inspect -f '{{.Config.Image}}' wechat-appointment-server-1)" = "$base_image"

mkdir -p "$backup"
cp "$compose" "$backup/docker-compose.yml"
cd "$app"
docker compose exec -T mysql sh -lc 'mysqldump --no-tablespaces --single-transaction --quick -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" promotion_daily_metrics _prisma_migrations' | gzip -1 > "$backup/promotion-daily-before.sql.gz"
test -s "$backup/promotion-daily-before.sql.gz"
gzip -t "$backup/promotion-daily-before.sql.gz"
patient_amount_snapshot="$(docker compose exec -T mysql sh -lc 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*), COALESCE(SUM(transactionAmount), 0), COALESCE(SUM(receivedAmount), 0) FROM promotion_arrival_patients"')"

nice -n 15 docker build --memory=384m --cpu-period=100000 --cpu-quota=50000 \
  --build-arg BASE_IMAGE="$base_image" \
  -f "$release/scripts/Dockerfile.runtime-promotion-stat-filters-overlay" \
  -t "$image" "$release"

sed -i "s#image: wechat-appointment-server:.*#image: $image#" "$compose"
docker compose run --rm --no-deps server npx prisma migrate deploy
test "$(docker compose exec -T mysql sh -lc 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM promotion_daily_metrics WHERE revenue <> 0"')" = '0'
test "$patient_amount_snapshot" = "$(docker compose exec -T mysql sh -lc 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*), COALESCE(SUM(transactionAmount), 0), COALESCE(SUM(receivedAmount), 0) FROM promotion_arrival_patients"')"

sudo -n rm -rf -- /var/www/fxnadmin.next /var/www/fxnadmin.rollback
sudo -n cp -a "$release/admin/dist" /var/www/fxnadmin.next
sudo -n mv -- /var/www/fxnadmin /var/www/fxnadmin.rollback
sudo -n mv -- /var/www/fxnadmin.next /var/www/fxnadmin

if ! docker compose up -d --no-deps server; then
  cp "$backup/docker-compose.yml" "$compose"
  docker compose up -d --no-deps server
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
  sudo -n rm -rf -- /var/www/fxnadmin
  sudo -n mv -- /var/www/fxnadmin.rollback /var/www/fxnadmin
  cp "$backup/docker-compose.yml" "$compose"
  docker compose up -d --no-deps server
  exit 1
fi

test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = '200'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/daily)" = '401'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://afterbeat.fuxiaonian.net/api/afterbeat/bootstrap)" = '200'
docker compose exec -T server npx prisma migrate status
sudo -n nginx -t

install -m 0644 "$release/server/src/modules/operations/operations.service.ts" "$app/server/src/modules/operations/operations.service.ts"
install -m 0644 "$release/server/src/modules/operations/dto.ts" "$app/server/src/modules/operations/dto.ts"
install -m 0644 "$release/server/test/promotion-arrival-statistics.spec.ts" "$app/server/test/promotion-arrival-statistics.spec.ts"
install -m 0644 "$release/server/prisma/schema.prisma" "$app/server/prisma/schema.prisma"
mkdir -p "$app/server/prisma/migrations/20261113000100_clear_manual_promotion_revenue"
install -m 0644 "$release/server/prisma/migrations/20261113000100_clear_manual_promotion_revenue/migration.sql" "$app/server/prisma/migrations/20261113000100_clear_manual_promotion_revenue/migration.sql"
install -m 0644 "$release/admin/src/views/OperationsDaily.vue" "$app/admin/src/views/OperationsDaily.vue"
install -m 0644 "$release/admin/src/views/OperationsSummary.vue" "$app/admin/src/views/OperationsSummary.vue"
install -m 0644 "$release/AGENTS.md" "$app/AGENTS.md"
install -m 0644 "$release/scripts/Dockerfile.runtime-promotion-stat-filters-overlay" "$app/scripts/Dockerfile.runtime-promotion-stat-filters-overlay"
install -m 0755 "$release/scripts/deploy-promotion-stat-filters-20261113.sh" "$app/scripts/deploy-promotion-stat-filters-20261113.sh"

docker image rm wechat-appointment-server:afterbeat-20261112 >/dev/null 2>&1 || true
docker image prune -f >/dev/null

sha256sum "$release/admin/dist/index.html" /var/www/fxnadmin/index.html
docker inspect -f '{{.Config.Image}} {{.State.Status}} {{.RestartCount}}' wechat-appointment-server-1
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' wechat-appointment-server-1
rm -rf -- "$release"
rm -f -- /tmp/wechat-promotion-stat-filters-20261113.tar.gz
