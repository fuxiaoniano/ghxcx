#!/usr/bin/env bash
set -euo pipefail

cd /opt/wechat-appointment
echo '---http---'
curl -sS -L --max-time 15 -o /dev/null -w '%{http_code} admin\n' https://wechatadmin.fuxiaonian.net/
curl -sS -L --max-time 15 -o /dev/null -w '%{http_code} website\n' https://wechat.fuxiaonian.net/
curl -sS --max-time 15 -o /dev/null -w '%{http_code} bootstrap\n' https://wechat.fuxiaonian.net/api/website/bootstrap
curl -sS --max-time 15 -o /dev/null -w '%{http_code} consultations\n' https://wechatadmin.fuxiaonian.net/api/admin/consultations

echo '---schema---'
docker compose exec -T mysql sh -eu -c \
  'mysql -N -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM consultation_forms LIKE '\''promotionAccountId'\''; SELECT CONCAT('\''consultations='\'', COUNT(*), '\'', linked='\'', COALESCE(SUM(promotionAccountId IS NOT NULL), 0)) FROM consultation_forms; SELECT CONCAT('\''active_promotion_accounts='\'', COUNT(*)) FROM promotion_accounts WHERE status = '\''ACTIVE'\'';"'

echo '---ui-markers---'
grep -l '选择推广账户' /var/www/fxnadmin/assets/ConsultationForms-*.js
grep -l '展示中' /var/www/fxnadmin/assets/WebsiteArticles-*.js

echo '---state---'
docker inspect --format 'restart={{.RestartCount}} status={{.State.Status}}' wechat-appointment-server-1
docker compose logs --since=5m server | grep -Ei 'error|exception|failed' | tail -20 || true
stat -c '%y %n' /var/www/fxnadmin/index.html

echo '---backup---'
du -sh /opt/wechat-appointment/deploy-backups/consultation-promotion-link-20260930-165131/*
