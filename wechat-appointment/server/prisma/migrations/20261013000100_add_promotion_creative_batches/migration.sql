CREATE TABLE `promotion_creative_material_snapshots` (
  `id` VARCHAR(32) NOT NULL, `originAccountId` VARCHAR(32) NOT NULL, `businessUnitKey` VARCHAR(120) NOT NULL,
  `platformAssetId` VARCHAR(160) NOT NULL, `platformAssetKind` VARCHAR(24) NOT NULL, `assetType` VARCHAR(40) NOT NULL, `componentField` VARCHAR(80) NULL,
  `name` VARCHAR(255) NOT NULL, `previewUrl` VARCHAR(1000) NULL, `status` VARCHAR(100) NULL, `auditStatus` VARCHAR(100) NULL,
  `payloadJson` JSON NOT NULL, `isDeleted` BOOLEAN NOT NULL DEFAULT false, `platformCreatedAt` DATETIME(3) NULL,
  `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pcms_origin_kind_asset_uq`(`originAccountId`, `platformAssetKind`, `platformAssetId`),
  INDEX `pcms_unit_type_deleted_ix`(`businessUnitKey`, `assetType`, `isDeleted`),
  INDEX `pcms_origin_type_status_ix`(`originAccountId`, `assetType`, `status`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_creative_template_cache` (
  `id` VARCHAR(32) NOT NULL, `accountId` VARCHAR(32) NOT NULL, `adgroupId` VARCHAR(80) NOT NULL, `templateId` VARCHAR(80) NOT NULL,
  `deliveryMode` VARCHAR(80) NOT NULL, `dynamicCreativeType` VARCHAR(80) NOT NULL, `templateName` VARCHAR(255) NOT NULL,
  `templateJson` JSON NOT NULL, `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pctc_acct_group_tpl_mode_type_uq`(`accountId`, `adgroupId`, `templateId`, `deliveryMode`, `dynamicCreativeType`),
  INDEX `pctc_acct_group_synced_ix`(`accountId`, `adgroupId`, `lastSyncedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_creative_batch_tasks` (
  `id` VARCHAR(32) NOT NULL, `dedupeKey` VARCHAR(96) NOT NULL, `requestFingerprint` VARCHAR(64) NOT NULL, `accountId` VARCHAR(32) NOT NULL,
  `businessUnitKey` VARCHAR(120) NOT NULL, `adgroupId` VARCHAR(80) NOT NULL, `marketingTargetId` VARCHAR(80) NULL, `templateId` VARCHAR(80) NOT NULL,
  `deliveryMode` VARCHAR(80) NOT NULL, `dynamicCreativeType` VARCHAR(80) NOT NULL, `combinationMode` VARCHAR(24) NOT NULL,
  `materialRules` JSON NOT NULL, `requestSnapshot` JSON NOT NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `totalCount` INTEGER NOT NULL DEFAULT 0, `successCount` INTEGER NOT NULL DEFAULT 0, `failedCount` INTEGER NOT NULL DEFAULT 0,
  `unknownCount` INTEGER NOT NULL DEFAULT 0, `skippedCount` INTEGER NOT NULL DEFAULT 0, `createdByAdminId` VARCHAR(32) NOT NULL,
  `submittedIp` VARCHAR(80) NULL, `submittedUserAgent` VARCHAR(255) NULL, `startedAt` DATETIME(3) NULL, `completedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pcbt_dedupe_uq`(`dedupeKey`), INDEX `pcbt_acct_status_created_ix`(`accountId`, `status`, `createdAt`),
  INDEX `pcbt_creator_created_ix`(`createdByAdminId`, `createdAt`), INDEX `pcbt_fingerprint_created_ix`(`requestFingerprint`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_creative_batch_items` (
  `id` VARCHAR(32) NOT NULL, `taskId` VARCHAR(32) NOT NULL, `sequence` INTEGER NOT NULL, `creativeName` VARCHAR(255) NOT NULL,
  `itemFingerprint` VARCHAR(64) NOT NULL, `platformRequestKey` VARCHAR(96) NOT NULL, `creativePayload` JSON NOT NULL, `materialSnapshot` JSON NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING', `platformCreativeId` VARCHAR(80) NULL, `platformRequestId` VARCHAR(160) NULL,
  `errorCode` VARCHAR(100) NULL, `errorMessage` VARCHAR(1000) NULL, `recoverySuggestion` VARCHAR(500) NULL, `verifyResult` JSON NULL,
  `submittedAt` DATETIME(3) NULL, `verifiedAt` DATETIME(3) NULL, `retryCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pcbi_task_seq_uq`(`taskId`, `sequence`), UNIQUE INDEX `pcbi_task_fingerprint_uq`(`taskId`, `itemFingerprint`),
  INDEX `pcbi_task_status_seq_ix`(`taskId`, `status`, `sequence`), INDEX `pcbi_platform_creative_ix`(`platformCreativeId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_creative_submission_logs` (
  `id` VARCHAR(32) NOT NULL, `taskId` VARCHAR(32) NOT NULL, `itemId` VARCHAR(32) NULL, `action` VARCHAR(80) NOT NULL,
  `status` VARCHAR(32) NOT NULL, `requestSummary` JSON NULL, `responseSummary` JSON NULL, `platformRequestId` VARCHAR(160) NULL,
  `errorCode` VARCHAR(100) NULL, `errorMessage` VARCHAR(1000) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `pcsl_task_created_ix`(`taskId`, `createdAt`), INDEX `pcsl_item_created_ix`(`itemId`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `promotion_creative_material_snapshots` ADD CONSTRAINT `pcms_origin_account_fk` FOREIGN KEY (`originAccountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotion_creative_template_cache` ADD CONSTRAINT `pctc_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotion_creative_batch_tasks` ADD CONSTRAINT `pcbt_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `promotion_creative_batch_items` ADD CONSTRAINT `pcbi_task_fk` FOREIGN KEY (`taskId`) REFERENCES `promotion_creative_batch_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotion_creative_submission_logs` ADD CONSTRAINT `pcsl_task_fk` FOREIGN KEY (`taskId`) REFERENCES `promotion_creative_batch_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotion_creative_submission_logs` ADD CONSTRAINT `pcsl_item_fk` FOREIGN KEY (`itemId`) REFERENCES `promotion_creative_batch_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
