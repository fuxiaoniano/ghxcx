#!/usr/bin/env bash
set -euo pipefail

archive='/tmp/admin-category-slug-20261112.tar.gz'
staging='/var/www/fxnadmin.category-slug-20261112.staging'
target='/var/www/fxnadmin'
rollback='/var/www/fxnadmin.rollback'

test -s "$archive"
sudo rm -rf -- "$staging"
sudo mkdir -p -- "$staging"
sudo tar -xzf "$archive" -C "$staging"
test -s "$staging/index.html"
test -d "$staging/assets"

sudo rm -rf -- "$rollback"
if test -d "$target"; then
  sudo mv -- "$target" "$rollback"
fi
sudo mv -- "$staging" "$target"

if ! sudo nginx -t || ! curl --fail --silent --show-error --max-time 15 https://wechatadmin.fuxiaonian.net/ >/dev/null; then
  sudo rm -rf -- "$target"
  if test -d "$rollback"; then
    sudo mv -- "$rollback" "$target"
  fi
  sudo nginx -t
  exit 1
fi

sha256sum "$target/index.html"
curl --fail --silent --show-error --max-time 15 -o /dev/null -w 'admin_http=%{http_code}\n' https://wechatadmin.fuxiaonian.net/
rm -f -- "$archive"
