CREATE TABLE `tencent_user_tokens` (
  `adminUserId` VARCHAR(32) NOT NULL,
  `tokenCipher` TEXT NOT NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`adminUserId`),
  CONSTRAINT `tencent_user_tokens_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Reuse an existing valid real-name token only when its authenticated updater
-- also owns the source Tencent account. Never assign an unowned global token.
-- If that user has saved more than one token, retain the most recently saved.
INSERT INTO `tencent_user_tokens` (`adminUserId`, `tokenCipher`, `expiresAt`, `createdAt`, `updatedAt`)
SELECT credential.`updatedByAdminId`, credential.`userTokenCipher`, credential.`userTokenExpiresAt`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `promotion_account_credentials` credential
JOIN `promotion_accounts` account ON account.`id` = credential.`accountId`
WHERE credential.`updatedByAdminId` = account.`ownerAdminId`
  AND account.`platform` LIKE '%腾讯%'
  AND credential.`userTokenCipher` IS NOT NULL AND credential.`userTokenCipher` <> ''
  AND (credential.`userTokenExpiresAt` IS NULL OR credential.`userTokenExpiresAt` > CURRENT_TIMESTAMP(3))
  AND NOT EXISTS (
    SELECT 1 FROM `promotion_account_credentials` newer
    JOIN `promotion_accounts` newer_account ON newer_account.`id` = newer.`accountId`
    WHERE newer.`updatedByAdminId` = credential.`updatedByAdminId`
      AND newer_account.`ownerAdminId` = newer.`updatedByAdminId`
      AND newer_account.`platform` LIKE '%腾讯%'
      AND newer.`userTokenCipher` IS NOT NULL AND newer.`userTokenCipher` <> ''
      AND (newer.`userTokenExpiresAt` IS NULL OR newer.`userTokenExpiresAt` > CURRENT_TIMESTAMP(3))
      AND (newer.`updatedAt` > credential.`updatedAt` OR (newer.`updatedAt` = credential.`updatedAt` AND newer.`id` > credential.`id`))
  );
