CREATE TABLE `promotion_accounts` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `platform` VARCHAR(80) NOT NULL,
    `accountNo` VARCHAR(120) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `promotion_accounts_platform_name_key`(`platform`, `name`),
    INDEX `promotion_accounts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_daily_metrics` (
    `id` VARCHAR(32) NOT NULL,
    `accountId` VARCHAR(32) NOT NULL,
    `statDate` DATE NOT NULL,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `leads` INTEGER NOT NULL DEFAULT 0,
    `validLeads` INTEGER NOT NULL DEFAULT 0,
    `appointments` INTEGER NOT NULL DEFAULT 0,
    `transactions` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `customMetrics` JSON NULL,
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `promotion_daily_metrics_accountId_statDate_key`(`accountId`, `statDate`),
    INDEX `promotion_daily_metrics_statDate_idx`(`statDate`),
    PRIMARY KEY (`id`),
    CONSTRAINT `promotion_daily_metrics_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
