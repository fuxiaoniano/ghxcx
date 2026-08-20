-- AlterTable
ALTER TABLE `admin_users`
    ADD COLUMN `nickname` VARCHAR(64) NOT NULL DEFAULT '',
    MODIFY COLUMN `passwordHash` VARCHAR(255) NULL,
    ADD COLUMN `oaOpenId` VARCHAR(128) NULL,
    ADD COLUMN `unionId` VARCHAR(128) NULL,
    ADD COLUMN `subscribedOfficialAccount` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `notifyEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `wechatBoundAt` DATETIME(3) NULL;

UPDATE `admin_users` SET `nickname` = `username` WHERE `nickname` = '';
UPDATE `admin_users`
SET `nickname` = '傅小念'
WHERE `role` = 'SUPER_ADMIN'
ORDER BY `createdAt` ASC
LIMIT 1;

-- Preserve the existing bound notification recipient named 傅小念.
UPDATE `admin_users` AS `admin`
JOIN (
    SELECT recipient.name, recipient.oaOpenId, recipient.unionId, recipient.enabled, recipient.boundAt
    FROM `system_configs` AS config,
    JSON_TABLE(
        config.`valueJson`,
        '$.recipients[*]' COLUMNS (
            name VARCHAR(64) PATH '$.name',
            oaOpenId VARCHAR(128) PATH '$.oaOpenId' NULL ON EMPTY,
            unionId VARCHAR(128) PATH '$.unionId' NULL ON EMPTY,
            enabled BOOLEAN PATH '$.enabled' DEFAULT 'true' ON EMPTY,
            boundAt VARCHAR(40) PATH '$.boundAt' NULL ON EMPTY
        )
    ) AS recipient
    WHERE config.`key` = 'appointmentNotify'
      AND recipient.name COLLATE utf8mb4_unicode_ci = '傅小念'
      AND recipient.oaOpenId IS NOT NULL
    LIMIT 1
) AS legacy ON admin.`nickname` = legacy.name COLLATE utf8mb4_unicode_ci
SET
    admin.`oaOpenId` = legacy.oaOpenId,
    admin.`unionId` = legacy.unionId,
    admin.`notifyEnabled` = legacy.enabled,
    admin.`wechatBoundAt` = COALESCE(STR_TO_DATE(LEFT(legacy.boundAt, 19), '%Y-%m-%dT%H:%i:%s'), NOW(3));

-- Convert other already-bound legacy recipients into staff accounts.
INSERT INTO `admin_users` (
    `id`, `username`, `nickname`, `passwordHash`, `role`, `permissionsJson`, `status`,
    `oaOpenId`, `unionId`, `subscribedOfficialAccount`, `notifyEnabled`, `wechatBoundAt`,
    `lastLoginAt`, `createdAt`, `updatedAt`
)
SELECT
    LOWER(REPLACE(UUID(), '-', '')),
    CONCAT('wx_', LEFT(SHA2(recipient.oaOpenId, 256), 20)),
    recipient.name,
    NULL,
    'STAFF',
    JSON_ARRAY('VIEW_FULL_PHONE', 'MANAGE_APPOINTMENTS'),
    'ACTIVE',
    recipient.oaOpenId,
    recipient.unionId,
    false,
    recipient.enabled,
    COALESCE(STR_TO_DATE(LEFT(recipient.boundAt, 19), '%Y-%m-%dT%H:%i:%s'), NOW(3)),
    NULL,
    NOW(3),
    NOW(3)
FROM `system_configs` AS config,
JSON_TABLE(
    config.`valueJson`,
    '$.recipients[*]' COLUMNS (
        name VARCHAR(64) PATH '$.name',
        oaOpenId VARCHAR(128) PATH '$.oaOpenId' NULL ON EMPTY,
        unionId VARCHAR(128) PATH '$.unionId' NULL ON EMPTY,
        enabled BOOLEAN PATH '$.enabled' DEFAULT 'true' ON EMPTY,
        boundAt VARCHAR(40) PATH '$.boundAt' NULL ON EMPTY
    )
) AS recipient
WHERE config.`key` = 'appointmentNotify'
  AND recipient.oaOpenId IS NOT NULL
  AND recipient.name COLLATE utf8mb4_unicode_ci <> '傅小念'
  AND NOT EXISTS (
      SELECT 1
      FROM `admin_users` existing
      WHERE existing.`oaOpenId` = recipient.oaOpenId COLLATE utf8mb4_unicode_ci
  );

-- CreateTable
CREATE TABLE `admin_wechat_invites` (
    `id` VARCHAR(32) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `nickname` VARCHAR(64) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `permissionsJson` JSON NOT NULL,
    `notifyEnabled` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('PENDING', 'BOUND', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `adminUserId` VARCHAR(32) NULL,
    `createdByAdminId` VARCHAR(32) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `boundAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_wechat_invites_tokenHash_key`(`tokenHash`),
    INDEX `admin_wechat_invites_status_expiresAt_idx`(`status`, `expiresAt`),
    INDEX `admin_wechat_invites_createdByAdminId_idx`(`createdByAdminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `admin_users_oaOpenId_key` ON `admin_users`(`oaOpenId`);
CREATE INDEX `admin_users_unionId_idx` ON `admin_users`(`unionId`);
CREATE INDEX `admin_users_notifyEnabled_status_idx` ON `admin_users`(`notifyEnabled`, `status`);
