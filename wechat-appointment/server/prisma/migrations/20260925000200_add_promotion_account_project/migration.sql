ALTER TABLE `promotion_accounts`
  ADD COLUMN `project` VARCHAR(40) NOT NULL DEFAULT '重庆' AFTER `name`;

UPDATE `promotion_accounts`
SET `project` = '绵阳'
WHERE `name` LIKE '%绵阳%' OR `remark` LIKE '%绵阳%';
