CREATE TABLE `landing_pages` (
  `id` VARCHAR(32) NOT NULL,
  `pageKey` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `configJson` JSON NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `landing_pages_pageKey_key`(`pageKey`),
  INDEX `landing_pages_status_idx`(`status`),
  INDEX `landing_pages_isDefault_idx`(`isDefault`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `landing_pages` (`id`, `pageKey`, `name`, `configJson`, `status`, `isDefault`, `createdAt`, `updatedAt`)
VALUES ('landing_default', 'default', '默认挂号页', JSON_OBJECT(), 'ACTIVE', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

UPDATE `landing_pages` AS `landing`
INNER JOIN `system_configs` AS `config` ON `config`.`key` = 'landingPage'
SET `landing`.`configJson` = `config`.`valueJson`, `landing`.`updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `landing`.`id` = 'landing_default';

ALTER TABLE `appointments` ADD COLUMN `landingPageId` VARCHAR(32) NULL;
CREATE INDEX `appointments_landingPageId_idx` ON `appointments`(`landingPageId`);
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_landingPageId_fkey`
  FOREIGN KEY (`landingPageId`) REFERENCES `landing_pages`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
