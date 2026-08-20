UPDATE `system_configs`
SET `valueJson` = JSON_REMOVE(`valueJson`, '$.recipients')
WHERE `key` = 'appointmentNotify'
  AND JSON_CONTAINS_PATH(`valueJson`, 'one', '$.recipients') = 1;
