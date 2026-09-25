ALTER TABLE `promotion_daily_report_notes`
  DROP INDEX IF EXISTS `promotion_daily_report_notes_statDate_project_channel_key`,
  ADD UNIQUE INDEX `promo_note_scope_uq` (`statDate`, `periodType`, `project`, `channel`);

ALTER TABLE `promotion_accounts`
  DROP INDEX IF EXISTS `promotion_accounts_platform_name_key`,
  ADD UNIQUE INDEX `promo_account_scope_uq` (`project`, `platform`, `name`);
