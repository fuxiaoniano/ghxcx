-- Existing administrators and roles keep ALL scope during upgrade to avoid unexpected loss of access.
ALTER TABLE `admin_role_definitions`
  ADD COLUMN `dataScope` ENUM('SELF', 'ASSIGNED_MEMBERS', 'TEAM', 'ALL') NOT NULL DEFAULT 'ALL',
  ADD COLUMN `dataScopeMemberIds` JSON NULL;

CREATE TABLE `admin_teams` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `leaderAdminId` VARCHAR(32) NULL,
  `parentId` VARCHAR(32) NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `admin_teams_name_key`(`name`),
  INDEX `admin_teams_parentId_idx`(`parentId`),
  INDEX `admin_teams_leaderAdminId_idx`(`leaderAdminId`),
  INDEX `admin_teams_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `admin_teams_leaderAdminId_fkey` FOREIGN KEY (`leaderAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `admin_teams_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `admin_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `admin_users`
  ADD COLUMN `dataScope` ENUM('SELF', 'ASSIGNED_MEMBERS', 'TEAM', 'ALL') NOT NULL DEFAULT 'ALL',
  ADD COLUMN `dataScopeMemberIds` JSON NULL,
  ADD COLUMN `teamId` VARCHAR(32) NULL,
  ADD COLUMN `consultationReceivable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `admin_users_teamId_idx` ON `admin_users`(`teamId`);
CREATE INDEX `admin_users_status_deletedAt_idx` ON `admin_users`(`status`, `deletedAt`);
ALTER TABLE `admin_users` ADD CONSTRAINT `admin_users_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `admin_teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `appointments`
  ADD COLUMN `createdByAdminId` VARCHAR(32) NULL;
CREATE INDEX `appointments_createdByAdminId_idx` ON `appointments`(`createdByAdminId`);
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tencent_ad_leads`
  ADD COLUMN `assignedToAdminId` VARCHAR(32) NULL,
  ADD COLUMN `createdByAdminId` VARCHAR(32) NULL;
CREATE INDEX `tencent_ad_leads_assignedToAdminId_idx` ON `tencent_ad_leads`(`assignedToAdminId`);
CREATE INDEX `tencent_ad_leads_createdByAdminId_idx` ON `tencent_ad_leads`(`createdByAdminId`);
ALTER TABLE `tencent_ad_leads` ADD CONSTRAINT `tencent_ad_leads_assignedToAdminId_fkey` FOREIGN KEY (`assignedToAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tencent_ad_leads` ADD CONSTRAINT `tencent_ad_leads_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `promotion_accounts`
  ADD COLUMN `ownerAdminId` VARCHAR(32) NULL,
  ADD COLUMN `createdByAdminId` VARCHAR(32) NULL;
CREATE INDEX `promotion_accounts_ownerAdminId_idx` ON `promotion_accounts`(`ownerAdminId`);
CREATE INDEX `promotion_accounts_createdByAdminId_idx` ON `promotion_accounts`(`createdByAdminId`);
ALTER TABLE `promotion_accounts` ADD CONSTRAINT `promotion_accounts_ownerAdminId_fkey` FOREIGN KEY (`ownerAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `promotion_accounts` ADD CONSTRAINT `promotion_accounts_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `consultation_statuses` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#457ea9',
  `sort` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `category` ENUM('IN_PROGRESS', 'COMPLETED', 'INVALID') NOT NULL DEFAULT 'IN_PROGRESS',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `consultation_statuses_code_key`(`code`),
  INDEX `consultation_statuses_enabled_sort_idx`(`enabled`, `sort`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_tags` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#838e7c',
  `sort` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdByAdminId` VARCHAR(32) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `consultation_tags_name_key`(`name`),
  INDEX `consultation_tags_enabled_sort_idx`(`enabled`, `sort`),
  INDEX `consultation_tags_createdByAdminId_idx`(`createdByAdminId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_tags_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_field_configs` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'CUSTOM',
  `type` ENUM('TEXT', 'TEXTAREA', 'SINGLE', 'MULTI', 'DATE', 'DATETIME', 'NUMBER') NOT NULL DEFAULT 'TEXT',
  `required` BOOLEAN NOT NULL DEFAULT false,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `showInForm` BOOLEAN NOT NULL DEFAULT true,
  `showInDetail` BOOLEAN NOT NULL DEFAULT true,
  `showInList` BOOLEAN NOT NULL DEFAULT false,
  `filterable` BOOLEAN NOT NULL DEFAULT false,
  `exportable` BOOLEAN NOT NULL DEFAULT false,
  `importable` BOOLEAN NOT NULL DEFAULT false,
  `listTitle` VARCHAR(80) NULL,
  `listOrder` INTEGER NOT NULL DEFAULT 0,
  `listWidth` INTEGER NOT NULL DEFAULT 140,
  `optionsJson` JSON NULL,
  `createdByAdminId` VARCHAR(32) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `consultation_field_configs_code_key`(`code`),
  INDEX `consultation_field_configs_source_enabled_listOrder_idx`(`source`, `enabled`, `listOrder`),
  INDEX `consultation_field_configs_createdByAdminId_idx`(`createdByAdminId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_field_configs_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_forms` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `phoneEncrypted` TEXT NOT NULL,
  `phoneHash` VARCHAR(128) NOT NULL,
  `phoneMasked` VARCHAR(32) NOT NULL,
  `projectId` VARCHAR(32) NOT NULL,
  `channelSource` VARCHAR(120) NOT NULL,
  `statusId` VARCHAR(32) NOT NULL,
  `ownerAdminId` VARCHAR(32) NOT NULL,
  `createdByAdminId` VARCHAR(32) NOT NULL,
  `lastOperatedByAdminId` VARCHAR(32) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastFollowUpAt` DATETIME(3) NULL,
  `nextFollowUpAt` DATETIME(3) NULL,
  `invalidReason` VARCHAR(500) NULL,
  `customData` JSON NULL,
  `duplicateOfId` VARCHAR(32) NULL,
  `duplicateReason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `consultation_forms_phoneHash_idx`(`phoneHash`),
  INDEX `consultation_forms_projectId_idx`(`projectId`),
  INDEX `consultation_forms_statusId_idx`(`statusId`),
  INDEX `consultation_forms_ownerAdminId_idx`(`ownerAdminId`),
  INDEX `consultation_forms_createdByAdminId_idx`(`createdByAdminId`),
  INDEX `consultation_forms_recordedAt_idx`(`recordedAt`),
  INDEX `consultation_forms_nextFollowUpAt_idx`(`nextFollowUpAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_forms_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `dental_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `consultation_forms_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `consultation_statuses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `consultation_forms_ownerAdminId_fkey` FOREIGN KEY (`ownerAdminId`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `consultation_forms_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `consultation_forms_lastOperatedByAdminId_fkey` FOREIGN KEY (`lastOperatedByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `consultation_forms_duplicateOfId_fkey` FOREIGN KEY (`duplicateOfId`) REFERENCES `consultation_forms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_follow_ups` (
  `id` VARCHAR(32) NOT NULL,
  `formId` VARCHAR(32) NOT NULL,
  `content` TEXT NOT NULL,
  `resultStatusId` VARCHAR(32) NULL,
  `nextFollowUpAt` DATETIME(3) NULL,
  `createdByAdminId` VARCHAR(32) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `consultation_follow_ups_formId_createdAt_idx`(`formId`, `createdAt`),
  INDEX `consultation_follow_ups_createdByAdminId_idx`(`createdByAdminId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_follow_ups_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `consultation_forms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `consultation_follow_ups_resultStatusId_fkey` FOREIGN KEY (`resultStatusId`) REFERENCES `consultation_statuses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `consultation_follow_ups_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_form_tags` (
  `formId` VARCHAR(32) NOT NULL,
  `tagId` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `consultation_form_tags_tagId_idx`(`tagId`),
  PRIMARY KEY (`formId`, `tagId`),
  CONSTRAINT `consultation_form_tags_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `consultation_forms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `consultation_form_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `consultation_tags`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_import_batches` (
  `id` VARCHAR(32) NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `status` ENUM('VALIDATED', 'COMMITTED', 'FAILED') NOT NULL DEFAULT 'VALIDATED',
  `operatorAdminId` VARCHAR(32) NULL,
  `totalCount` INTEGER NOT NULL DEFAULT 0,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `duplicateCount` INTEGER NOT NULL DEFAULT 0,
  `optionsJson` JSON NULL,
  `previewJson` JSON NULL,
  `committedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `consultation_import_batches_operatorAdminId_createdAt_idx`(`operatorAdminId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_import_batches_operatorAdminId_fkey` FOREIGN KEY (`operatorAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_import_errors` (
  `id` VARCHAR(32) NOT NULL,
  `batchId` VARCHAR(32) NOT NULL,
  `rowNumber` INTEGER NOT NULL,
  `field` VARCHAR(80) NULL,
  `message` VARCHAR(500) NOT NULL,
  `rowJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `consultation_import_errors_batchId_rowNumber_idx`(`batchId`, `rowNumber`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_import_errors_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `consultation_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `consultation_list_preferences` (
  `id` VARCHAR(32) NOT NULL,
  `adminUserId` VARCHAR(32) NOT NULL,
  `columnsJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `consultation_list_preferences_adminUserId_key`(`adminUserId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `consultation_list_preferences_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `consultation_statuses` (`id`, `name`, `code`, `color`, `sort`, `enabled`, `category`, `updatedAt`) VALUES
  ('consult_status_pending', '待跟进', 'PENDING', '#457ea9', 10, true, 'IN_PROGRESS', NOW(3)),
  ('consult_status_following', '跟进中', 'FOLLOWING', '#c48c4e', 20, true, 'IN_PROGRESS', NOW(3)),
  ('consult_status_visited', '已到诊', 'VISITED', '#838e7c', 30, true, 'IN_PROGRESS', NOW(3)),
  ('consult_status_deal', '已成交', 'DEAL', '#3f8f76', 40, true, 'COMPLETED', NOW(3)),
  ('consult_status_invalid', '无效', 'INVALID', '#9b6262', 50, true, 'INVALID', NOW(3));

INSERT INTO `consultation_field_configs`
  (`id`, `name`, `code`, `source`, `type`, `required`, `enabled`, `showInForm`, `showInDetail`, `showInList`, `filterable`, `exportable`, `importable`, `listTitle`, `listOrder`, `listWidth`, `updatedAt`) VALUES
  ('consult_field_name', '姓名', 'name', 'FIXED', 'TEXT', true, true, true, true, true, true, true, true, '姓名', 10, 110, NOW(3)),
  ('consult_field_phone', '电话', 'phone', 'FIXED', 'TEXT', true, true, true, true, true, true, true, true, '电话', 20, 130, NOW(3)),
  ('consult_field_project', '项目', 'project', 'FIXED', 'TEXT', true, true, true, true, true, true, true, true, '项目', 30, 120, NOW(3)),
  ('consult_field_channel', '渠道来源', 'channelSource', 'FIXED', 'TEXT', true, true, true, true, true, true, true, true, '渠道来源', 40, 120, NOW(3)),
  ('consult_field_tags', '标签', 'tags', 'FIXED', 'TEXT', false, true, true, true, true, true, true, true, '标签', 50, 160, NOW(3)),
  ('consult_field_status', '状态', 'status', 'FIXED', 'TEXT', false, true, true, true, true, true, true, true, '状态', 60, 100, NOW(3)),
  ('consult_field_owner', '当前负责人', 'owner', 'FIXED', 'TEXT', false, true, true, true, true, true, true, true, '当前负责人', 70, 120, NOW(3)),
  ('consult_field_recorded', '录单时间', 'recordedAt', 'FIXED', 'DATETIME', false, true, true, true, true, true, true, true, '录单时间', 80, 170, NOW(3)),
  ('consult_field_last_follow', '最近跟进时间', 'lastFollowUpAt', 'FIXED', 'DATETIME', false, true, true, true, true, true, true, false, '最近跟进时间', 90, 170, NOW(3)),
  ('consult_field_next_follow', '下次回访时间', 'nextFollowUpAt', 'FIXED', 'DATETIME', false, true, true, true, true, true, true, true, '下次回访时间', 100, 170, NOW(3)),
  ('consult_field_overdue', '是否逾期', 'overdue', 'FIXED', 'TEXT', false, true, true, true, true, true, true, false, '是否逾期', 110, 90, NOW(3)),
  ('consult_field_creator', '创建人', 'createdBy', 'FIXED', 'TEXT', false, true, true, true, true, true, true, false, '创建人', 120, 110, NOW(3)),
  ('consult_field_created', '创建时间', 'createdAt', 'FIXED', 'DATETIME', false, true, true, true, true, true, true, false, '创建时间', 130, 170, NOW(3)),
  ('consult_field_updated', '更新时间', 'updatedAt', 'FIXED', 'DATETIME', false, true, true, true, true, true, true, false, '更新时间', 140, 170, NOW(3));
