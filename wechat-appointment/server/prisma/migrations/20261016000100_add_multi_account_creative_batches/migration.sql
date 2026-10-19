CREATE TABLE `multi_account_creative_batches` (
  `id` VARCHAR(32) NOT NULL, `taskNo` VARCHAR(48) NOT NULL, `dedupeKey` VARCHAR(96) NOT NULL,
  `requestFingerprint` VARCHAR(64) NOT NULL, `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  `creativeType` VARCHAR(80) NOT NULL, `deliveryMode` VARCHAR(80) NOT NULL, `combinationMode` VARCHAR(32) NOT NULL,
  `generationRules` JSON NOT NULL, `requestSnapshot` JSON NOT NULL, `allowSkipInvalid` BOOLEAN NOT NULL DEFAULT false,
  `totalAccountCount` INTEGER NOT NULL DEFAULT 0, `totalAdgroupCount` INTEGER NOT NULL DEFAULT 0,
  `totalCreativeCount` INTEGER NOT NULL DEFAULT 0, `confirmedCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0, `skippedCount` INTEGER NOT NULL DEFAULT 0,
  `pendingVerifyCount` INTEGER NOT NULL DEFAULT 0, `createdByAdminId` VARCHAR(32) NOT NULL,
  `submittedIp` VARCHAR(80) NULL, `submittedUserAgent` VARCHAR(255) NULL,
  `startedAt` DATETIME(3) NULL, `completedAt` DATETIME(3) NULL, `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `macb_task_no_uq`(`taskNo`), UNIQUE INDEX `macb_dedupe_uq`(`dedupeKey`),
  INDEX `macb_status_created_ix`(`status`, `createdAt`), INDEX `macb_creator_created_ix`(`createdByAdminId`, `createdAt`),
  INDEX `macb_fingerprint_created_ix`(`requestFingerprint`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `logical_creative_assets` (
  `id` VARCHAR(32) NOT NULL, `batchId` VARCHAR(32) NOT NULL, `sourceSnapshotId` VARCHAR(32) NULL,
  `assetType` VARCHAR(40) NOT NULL, `sourceType` VARCHAR(24) NOT NULL, `sourceAccountId` VARCHAR(32) NULL,
  `sourceBusinessUnit` VARCHAR(120) NULL, `sourcePlatformAssetId` VARCHAR(160) NOT NULL,
  `name` VARCHAR(255) NOT NULL, `fingerprint` VARCHAR(64) NOT NULL, `specification` JSON NULL,
  `snapshot` JSON NOT NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `snapshottedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `lca_batch_fingerprint_uq`(`batchId`, `fingerprint`), INDEX `lca_batch_type_ix`(`batchId`, `assetType`),
  INDEX `lca_source_asset_ix`(`sourceAccountId`, `sourcePlatformAssetId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `creative_asset_target_mappings` (
  `id` VARCHAR(32) NOT NULL, `logicalAssetId` VARCHAR(32) NOT NULL, `targetAccountId` VARCHAR(32) NOT NULL,
  `targetPlatformAssetId` VARCHAR(160) NULL, `mappingStatus` VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
  `validationSource` VARCHAR(80) NULL, `failureReason` VARCHAR(1000) NULL, `platformAssetStatus` VARCHAR(100) NULL,
  `templateCompatible` BOOLEAN NOT NULL DEFAULT false, `validatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `catm_asset_account_uq`(`logicalAssetId`, `targetAccountId`),
  INDEX `catm_account_status_ix`(`targetAccountId`, `mappingStatus`, `validatedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `multi_account_creative_batch_targets` (
  `id` VARCHAR(32) NOT NULL, `batchId` VARCHAR(32) NOT NULL, `accountId` VARCHAR(32) NOT NULL,
  `adgroupId` VARCHAR(80) NOT NULL, `adgroupName` VARCHAR(255) NULL, `marketingGoal` VARCHAR(100) NULL,
  `templateId` VARCHAR(80) NULL, `templateName` VARCHAR(255) NULL, `creativeType` VARCHAR(80) NOT NULL,
  `preflightStatus` VARCHAR(32) NOT NULL DEFAULT 'PENDING', `preflightResult` JSON NULL,
  `resolvedComponents` JSON NULL, `assetMappingResult` JSON NULL,
  `executionStatus` VARCHAR(40) NOT NULL DEFAULT 'PENDING', `failureReason` VARCHAR(1000) NULL,
  `idempotencyKey` VARCHAR(96) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `macbt_idempotency_uq`(`idempotencyKey`), UNIQUE INDEX `macbt_batch_account_group_uq`(`batchId`, `accountId`, `adgroupId`),
  INDEX `macbt_account_group_status_ix`(`accountId`, `adgroupId`, `executionStatus`),
  INDEX `macbt_batch_preflight_ix`(`batchId`, `preflightStatus`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `multi_account_creative_batch_items` (
  `id` VARCHAR(32) NOT NULL, `targetId` VARCHAR(32) NOT NULL, `sequence` INTEGER NOT NULL,
  `creativeName` VARCHAR(255) NOT NULL, `materialCombination` JSON NOT NULL, `requestPayload` JSON NOT NULL,
  `requestFingerprint` VARCHAR(64) NOT NULL, `idempotencyKey` VARCHAR(96) NOT NULL,
  `platformRequestId` VARCHAR(160) NULL, `platformCreativeId` VARCHAR(80) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING', `retryCount` INTEGER NOT NULL DEFAULT 0,
  `verificationAttempts` INTEGER NOT NULL DEFAULT 0, `lastRequestedAt` DATETIME(3) NULL, `lastVerifiedAt` DATETIME(3) NULL,
  `platformResponse` JSON NULL, `verificationResult` JSON NULL, `errorCode` VARCHAR(100) NULL, `errorMessage` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `macbi_idempotency_uq`(`idempotencyKey`), UNIQUE INDEX `macbi_target_seq_uq`(`targetId`, `sequence`),
  INDEX `macbi_target_status_seq_ix`(`targetId`, `status`, `sequence`), INDEX `macbi_platform_creative_ix`(`platformCreativeId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `multi_account_creative_submission_logs` (
  `id` VARCHAR(32) NOT NULL, `batchId` VARCHAR(32) NOT NULL, `itemId` VARCHAR(32) NULL,
  `action` VARCHAR(80) NOT NULL, `status` VARCHAR(40) NOT NULL, `requestSummary` JSON NULL,
  `responseSummary` JSON NULL, `platformRequestId` VARCHAR(160) NULL, `errorCode` VARCHAR(100) NULL,
  `errorMessage` VARCHAR(1000) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `macsl_batch_created_ix`(`batchId`, `createdAt`), INDEX `macsl_item_created_ix`(`itemId`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `creative_account_default_components` (
  `id` VARCHAR(32) NOT NULL, `accountId` VARCHAR(32) NOT NULL, `componentType` VARCHAR(80) NOT NULL,
  `platformComponentId` VARCHAR(160) NOT NULL, `componentName` VARCHAR(255) NOT NULL,
  `creativeType` VARCHAR(80) NULL, `marketingGoal` VARCHAR(100) NULL, `templateId` VARCHAR(80) NULL,
  `componentSnapshot` JSON NOT NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', `priority` INTEGER NOT NULL DEFAULT 0,
  `lastValidatedAt` DATETIME(3) NULL, `createdByAdminId` VARCHAR(32) NOT NULL, `updatedByAdminId` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `cadc_account_status_priority_ix`(`accountId`, `status`, `priority`),
  INDEX `cadc_resolve_ix`(`accountId`, `componentType`, `templateId`, `creativeType`, `marketingGoal`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `logical_creative_assets` ADD CONSTRAINT `lca_batch_fk` FOREIGN KEY (`batchId`) REFERENCES `multi_account_creative_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `logical_creative_assets` ADD CONSTRAINT `lca_snapshot_fk` FOREIGN KEY (`sourceSnapshotId`) REFERENCES `promotion_creative_material_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `creative_asset_target_mappings` ADD CONSTRAINT `catm_asset_fk` FOREIGN KEY (`logicalAssetId`) REFERENCES `logical_creative_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `creative_asset_target_mappings` ADD CONSTRAINT `catm_account_fk` FOREIGN KEY (`targetAccountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `multi_account_creative_batch_targets` ADD CONSTRAINT `macbt_batch_fk` FOREIGN KEY (`batchId`) REFERENCES `multi_account_creative_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `multi_account_creative_batch_targets` ADD CONSTRAINT `macbt_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `multi_account_creative_batch_items` ADD CONSTRAINT `macbi_target_fk` FOREIGN KEY (`targetId`) REFERENCES `multi_account_creative_batch_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `multi_account_creative_submission_logs` ADD CONSTRAINT `macsl_batch_fk` FOREIGN KEY (`batchId`) REFERENCES `multi_account_creative_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `multi_account_creative_submission_logs` ADD CONSTRAINT `macsl_item_fk` FOREIGN KEY (`itemId`) REFERENCES `multi_account_creative_batch_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `creative_account_default_components` ADD CONSTRAINT `cadc_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
