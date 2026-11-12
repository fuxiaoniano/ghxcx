ALTER TABLE `promotion_daily_metrics`
  ADD COLUMN `syncSource` VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `syncedAt` DATETIME(3) NULL,
  ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `promotion_data_sync_configs` (
  `id` VARCHAR(32) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `reportUrl` VARCHAR(500) NOT NULL,
  `accessTokenCipher` TEXT NULL,
  `extraConfig` JSON NULL,
  `lastSyncedAt` DATETIME(3) NULL,
  `lastSyncMessage` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `promotion_data_sync_configs_provider_key` (`provider`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
