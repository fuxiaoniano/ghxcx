-- 成交金额和实收金额统一以患者收费明细为唯一来源。
-- promotion_daily_metrics 不存储成交金额；清理其中历史手工实收，避免后续误用或重复统计。
UPDATE `promotion_daily_metrics`
SET `revenue` = 0
WHERE `revenue` <> 0;
