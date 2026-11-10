#!/usr/bin/env bash
set -euo pipefail
sleep 3
test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
sudo -n nginx -t
test -f /var/www/fxnadmin/index.html
test -f /var/www/fxnadmin.rollback/index.html
grep -Rqs 'mobile-nav-open' /var/www/fxnadmin/assets
