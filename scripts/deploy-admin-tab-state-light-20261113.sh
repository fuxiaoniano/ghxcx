#!/usr/bin/env bash
set -euo pipefail

app='/opt/wechat-appointment'
release='/tmp/wechat-admin-tab-state-20261113'
archive='/tmp/wechat-admin-tab-state-20261113.tar.gz'
next='/var/www/fxnadmin.tab-state-20261113.next'
rollback='/var/www/fxnadmin.rollback'
current='/var/www/fxnadmin'

test -s "$release/admin/dist/index.html"
test -s "$release/admin/src/views/Layout.vue"
test -s "$release/admin/src/views/PromotionCreativeBatch.vue"
test -s "$release/AGENTS.md"

sudo -n rm -rf -- "$next"
sudo -n cp -a "$release/admin/dist" "$next"
test -s "$next/index.html"

swapped='false'
rollback_static() {
  if test "$swapped" = 'true'; then
    sudo -n rm -rf -- "$current"
    sudo -n mv -- "$rollback" "$current"
  fi
}
trap rollback_static ERR

sudo -n rm -rf -- "$rollback"
sudo -n mv -- "$current" "$rollback"
sudo -n mv -- "$next" "$current"
swapped='true'
sudo -n chown -R www-data:www-data "$current"
sudo -n nginx -t
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = '200'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://wechatadmin.fuxiaonian.net/api/admin/operations/daily)" = '401'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://afterbeat.fuxiaonian.net/api/afterbeat/bootstrap)" = '200'

install -m 0644 "$release/admin/src/views/Layout.vue" "$app/admin/src/views/Layout.vue"
install -m 0644 "$release/admin/src/views/PromotionCreativeBatch.vue" "$app/admin/src/views/PromotionCreativeBatch.vue"
install -m 0644 "$release/AGENTS.md" "$app/AGENTS.md"
install -m 0755 "$release/scripts/deploy-admin-tab-state-light-20261113.sh" "$app/scripts/deploy-admin-tab-state-light-20261113.sh"

sha256sum "$release/admin/dist/index.html" "$current/index.html"
docker inspect -f '{{.Config.Image}} {{.State.Status}} {{.RestartCount}}' wechat-appointment-server-1
rm -rf -- "$release"
rm -f -- "$archive"
trap - ERR
printf 'ADMIN_TAB_STATE_LIGHT_DEPLOY_OK\n'
