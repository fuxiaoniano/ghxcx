CREATE TABLE `wechat_group_senders` (
  `id` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'UNAVAILABLE',
  `nickname` VARCHAR(120) NULL,
  `accountIdentifier` VARCHAR(191) NULL,
  `clientVersion` VARCHAR(80) NULL,
  `adapterVersion` VARCHAR(80) NULL,
  `lastHeartbeatAt` DATETIME(3) NULL,
  `lastError` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `wechat_group_senders_status_lastHeartbeatAt_idx` (`status`, `lastHeartbeatAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `wechat_target_groups` (
  `id` VARCHAR(32) NOT NULL,
  `senderId` VARCHAR(32) NOT NULL,
  `remoteGroupId` VARCHAR(191) NOT NULL,
  `nameSnapshot` VARCHAR(191) NOT NULL,
  `verified` BOOLEAN NOT NULL DEFAULT false,
  `lastVerifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `wechat_target_groups_senderId_remoteGroupId_key` (`senderId`, `remoteGroupId`),
  INDEX `wechat_target_groups_verified_lastVerifiedAt_idx` (`verified`, `lastVerifiedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `wechat_group_routes` (
  `id` VARCHAR(32) NOT NULL,
  `landingPageId` VARCHAR(32) NOT NULL,
  `groupId` VARCHAR(32) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `includeFullPhone` BOOLEAN NOT NULL DEFAULT false,
  `activatedAt` DATETIME(3) NULL,
  `createdById` VARCHAR(32) NULL,
  `updatedById` VARCHAR(32) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `wechat_group_routes_landingPageId_groupId_key` (`landingPageId`, `groupId`),
  INDEX `wechat_group_routes_enabled_landingPageId_idx` (`enabled`, `landingPageId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `wechat_group_deliveries` (
  `id` VARCHAR(32) NOT NULL,
  `appointmentId` VARCHAR(32) NOT NULL,
  `groupId` VARCHAR(32) NOT NULL,
  `routeId` VARCHAR(32) NOT NULL,
  `notificationType` VARCHAR(40) NOT NULL DEFAULT 'NEW_APPOINTMENT',
  `status` ENUM('PENDING','SENDING','SENT_BY_CLIENT','GROUP_CONFIRMED','FAILED','UNKNOWN','SKIPPED') NOT NULL DEFAULT 'PENDING',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `leaseUntil` DATETIME(3) NULL,
  `firstSentAt` DATETIME(3) NULL,
  `confirmedAt` DATETIME(3) NULL,
  `lastErrorCode` VARCHAR(80) NULL,
  `lastErrorMessage` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `wg_delivery_appt_group_type_key` (`appointmentId`, `groupId`, `notificationType`),
  INDEX `wechat_group_deliveries_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `wechat_group_deliveries_routeId_createdAt_idx` (`routeId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `wechat_group_delivery_attempts` (
  `id` VARCHAR(32) NOT NULL,
  `deliveryId` VARCHAR(32) NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `errorCode` VARCHAR(80) NULL,
  `errorMessage` VARCHAR(500) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  INDEX `wechat_group_delivery_attempts_deliveryId_startedAt_idx` (`deliveryId`, `startedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `wechat_target_groups` ADD CONSTRAINT `wechat_target_groups_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `wechat_group_senders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_routes` ADD CONSTRAINT `wechat_group_routes_landingPageId_fkey` FOREIGN KEY (`landingPageId`) REFERENCES `landing_pages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_routes` ADD CONSTRAINT `wechat_group_routes_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `wechat_target_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_deliveries` ADD CONSTRAINT `wechat_group_deliveries_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_deliveries` ADD CONSTRAINT `wechat_group_deliveries_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `wechat_target_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_deliveries` ADD CONSTRAINT `wechat_group_deliveries_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `wechat_group_routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `wechat_group_delivery_attempts` ADD CONSTRAINT `wechat_group_delivery_attempts_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `wechat_group_deliveries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
