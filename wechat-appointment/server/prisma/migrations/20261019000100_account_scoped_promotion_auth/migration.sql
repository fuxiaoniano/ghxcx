CREATE TABLE `promotion_account_credentials` (
  `id` VARCHAR(32) NOT NULL,
  `accountId` VARCHAR(32) NOT NULL,
  `accessTokenCipher` TEXT NULL,
  `clientId` VARCHAR(255) NULL,
  `clientSecretCipher` TEXT NULL,
  `refreshTokenCipher` TEXT NULL,
  `userTokenCipher` TEXT NULL,
  `userTokenExpiresAt` DATETIME(3) NULL,
  `authorizedAccountId` VARCHAR(120) NULL,
  `accessTokenExpiresAt` DATETIME(3) NULL,
  `refreshTokenExpiresAt` DATETIME(3) NULL,
  `updatedByAdminId` VARCHAR(32) NULL,
  `lastValidatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pac_account_uq` (`accountId`),
  INDEX `promotion_account_credentials_updatedByAdminId_idx` (`updatedByAdminId`),
  CONSTRAINT `pac_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `promotion_account_credentials_updatedByAdminId_fkey` FOREIGN KEY (`updatedByAdminId`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_account_access_grants` (
  `id` VARCHAR(32) NOT NULL,
  `accountId` VARCHAR(32) NOT NULL,
  `adminUserId` VARCHAR(32) NOT NULL,
  `grantedByAdminId` VARCHAR(32) NOT NULL,
  `canViewData` BOOLEAN NOT NULL DEFAULT false,
  `canViewMaterials` BOOLEAN NOT NULL DEFAULT false,
  `canViewCreatives` BOOLEAN NOT NULL DEFAULT false,
  `canCreateCreatives` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pacg_account_recipient_uq` (`accountId`, `adminUserId`),
  INDEX `promotion_account_access_grants_adminUserId_idx` (`adminUserId`),
  INDEX `promotion_account_access_grants_grantedByAdminId_idx` (`grantedByAdminId`),
  CONSTRAINT `pacg_account_fk` FOREIGN KEY (`accountId`) REFERENCES `promotion_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pacg_recipient_fk` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pacg_issuer_fk` FOREIGN KEY (`grantedByAdminId`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Safely move the legacy Tencent credentials only to the account whose ID was
-- explicitly recorded by the OAuth flow. Unbound legacy tokens remain unused.
INSERT IGNORE INTO `promotion_account_credentials`
  (`id`, `accountId`, `accessTokenCipher`, `clientId`, `clientSecretCipher`, `refreshTokenCipher`, `userTokenCipher`, `userTokenExpiresAt`, `authorizedAccountId`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `createdAt`, `updatedAt`)
SELECT
  REPLACE(UUID(), '-', ''), account.`id`, sync.`accessTokenCipher`,
  JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.clientId')),
  JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.clientSecretCipher')),
  JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.refreshTokenCipher')),
  JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.userTokenCipher')),
  STR_TO_DATE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.userTokenExpiresAt')), 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s.%f'),
  JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.authorizedAccountId')),
  STR_TO_DATE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.accessTokenExpiresAt')), 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s.%f'),
  STR_TO_DATE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.refreshTokenExpiresAt')), 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s.%f'),
  CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `promotion_accounts` account
JOIN `promotion_data_sync_configs` sync ON sync.`provider` = 'TENCENT_ADS'
WHERE JSON_UNQUOTE(JSON_EXTRACT(sync.`extraConfig`, '$.authorizedAccountId')) = account.`accountNo`
  AND account.`platform` LIKE '%腾讯%';
