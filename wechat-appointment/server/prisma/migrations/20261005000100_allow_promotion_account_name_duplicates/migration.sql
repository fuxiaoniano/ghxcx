ALTER TABLE `promotion_accounts`
  DROP INDEX `promo_account_scope_uq`,
  ADD INDEX `promotion_accounts_project_platform_name_idx` (`project`, `platform`, `name`),
  ADD INDEX `promotion_accounts_accountNo_idx` (`accountNo`);
