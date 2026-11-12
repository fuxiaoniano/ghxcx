CREATE TABLE `smart_monitor_channel_policies` (
    `id` VARCHAR(32) NOT NULL,
    `channelKey` VARCHAR(80) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `spendThreshold` DECIMAL(12,2) NOT NULL DEFAULT 1000,
    `emptySpendThreshold` DECIMAL(12,2) NOT NULL DEFAULT 200,
    `cpaThreshold` DECIMAL(12,2) NOT NULL DEFAULT 300,
    `maxReportAgeMinutes` INTEGER NOT NULL DEFAULT 360,
    `autoEnabled` BOOLEAN NOT NULL DEFAULT false,
    `emergencyStop` BOOLEAN NOT NULL DEFAULT true,
    `updatedByAdminId` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `smcp_channel_uq`(`channelKey`),
    INDEX `smcp_poll_ix`(`enabled`, `channelKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
