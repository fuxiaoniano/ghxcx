-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NULL,
    `phoneEncrypted` TEXT NULL,
    `phoneHash` VARCHAR(128) NULL,
    `phoneMasked` VARCHAR(32) NULL,
    `ageRange` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_phoneHash_key`(`phoneHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wechat_identities` (
    `id` VARCHAR(32) NOT NULL,
    `userId` VARCHAR(32) NOT NULL,
    `miniOpenId` VARCHAR(128) NULL,
    `oaOpenId` VARCHAR(128) NULL,
    `unionId` VARCHAR(128) NULL,
    `sessionKeyEncrypted` TEXT NULL,
    `subscribedOfficialAccount` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wechat_identities_miniOpenId_key`(`miniOpenId`),
    UNIQUE INDEX `wechat_identities_oaOpenId_key`(`oaOpenId`),
    INDEX `wechat_identities_userId_idx`(`userId`),
    INDEX `wechat_identities_miniOpenId_idx`(`miniOpenId`),
    INDEX `wechat_identities_oaOpenId_idx`(`oaOpenId`),
    INDEX `wechat_identities_unionId_idx`(`unionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointments` (
    `id` VARCHAR(32) NOT NULL,
    `appointmentNo` VARCHAR(40) NOT NULL,
    `userId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `phoneEncrypted` TEXT NOT NULL,
    `phoneHash` VARCHAR(128) NOT NULL,
    `phoneMasked` VARCHAR(32) NOT NULL,
    `ageRange` VARCHAR(32) NOT NULL,
    `missingTeethType` VARCHAR(32) NOT NULL,
    `clinicId` VARCHAR(32) NULL,
    `source` VARCHAR(120) NULL,
    `status` ENUM('PENDING_CONTACT', 'CONTACTED', 'CONFIRMED', 'VISITED', 'CANCELLED', 'INVALID') NOT NULL DEFAULT 'PENDING_CONTACT',
    `remark` TEXT NULL,
    `adminRemark` TEXT NULL,
    `assignedToAdminId` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contactedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    UNIQUE INDEX `appointments_appointmentNo_key`(`appointmentNo`),
    INDEX `appointments_userId_idx`(`userId`),
    INDEX `appointments_phoneHash_idx`(`phoneHash`),
    INDEX `appointments_status_idx`(`status`),
    INDEX `appointments_clinicId_idx`(`clinicId`),
    INDEX `appointments_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_logs` (
    `id` VARCHAR(32) NOT NULL,
    `userId` VARCHAR(32) NOT NULL,
    `appointmentId` VARCHAR(32) NULL,
    `channel` ENUM('OFFICIAL_ACCOUNT_TEMPLATE', 'MINI_PROGRAM_SUBSCRIBE') NOT NULL,
    `targetOpenId` VARCHAR(128) NULL,
    `templateId` VARCHAR(128) NULL,
    `payloadJson` JSON NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `errorCode` VARCHAR(64) NULL,
    `errorMessage` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `notification_logs_userId_idx`(`userId`),
    INDEX `notification_logs_appointmentId_idx`(`appointmentId`),
    INDEX `notification_logs_channel_idx`(`channel`),
    INDEX `notification_logs_status_idx`(`status`),
    INDEX `notification_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(32) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `permissionsJson` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(32) NOT NULL,
    `adminUserId` VARCHAR(32) NULL,
    `action` VARCHAR(80) NOT NULL,
    `resourceType` VARCHAR(80) NOT NULL,
    `resourceId` VARCHAR(80) NULL,
    `beforeJson` JSON NULL,
    `afterJson` JSON NULL,
    `ip` VARCHAR(80) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_adminUserId_idx`(`adminUserId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_resourceType_resourceId_idx`(`resourceType`, `resourceId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` VARCHAR(32) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `valueJson` JSON NOT NULL,
    `description` VARCHAR(255) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinics` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `clinics_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wechat_identities` ADD CONSTRAINT `wechat_identities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_assignedToAdminId_fkey` FOREIGN KEY (`assignedToAdminId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
