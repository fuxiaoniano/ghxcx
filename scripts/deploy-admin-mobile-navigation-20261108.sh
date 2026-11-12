#!/usr/bin/env bash
set -euo pipefail
APP=/opt/wechat-appointment
RELEASE=/tmp/wechat-admin-mobile-navigation-20261108
CURRENT=/var/www/fxnadmin
NEXT=/var/www/fxnadmin.next
ROLLBACK=/var/www/fxnadmin.rollback

sudo -n rm -rf "$NEXT" "$ROLLBACK" /var/www/fxnadmin.previous
sudo -n cp -a "$CURRENT" "$ROLLBACK"
sudo -n cp -a "$RELEASE/admin/dist" "$NEXT"
sudo -n mv "$CURRENT" /var/www/fxnadmin.previous
sudo -n mv "$NEXT" "$CURRENT"
sudo -n rm -rf /var/www/fxnadmin.previous

test "$(curl -sS -o /dev/null -w '%{http_code}' https://wechatadmin.fuxiaonian.net/)" = 200
sudo -n nginx -t
sha256sum "$RELEASE/admin/dist/index.html" "$CURRENT/index.html"
cp "$RELEASE/AGENTS.md" "$APP/AGENTS.md"

rm -rf "$RELEASE"
rm -f /tmp/wechat-admin-mobile-navigation-20261108.tar.gz
