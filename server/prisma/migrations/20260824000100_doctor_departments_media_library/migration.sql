ALTER TABLE `doctors`
  ADD COLUMN `displayText` VARCHAR(120) NULL AFTER `title`;

CREATE TABLE `doctor_departments` (
  `id` VARCHAR(32) NOT NULL,
  `doctorId` VARCHAR(32) NOT NULL,
  `departmentId` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `doctor_departments_doctorId_departmentId_key` (`doctorId`, `departmentId`),
  INDEX `doctor_departments_departmentId_doctorId_idx` (`departmentId`, `doctorId`),
  CONSTRAINT `doctor_departments_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `doctor_departments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `dental_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `doctor_departments` (`id`, `doctorId`, `departmentId`, `createdAt`)
SELECT CONCAT('dd', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 30)), `id`, `departmentId`, CURRENT_TIMESTAMP(3)
FROM `doctors`;

CREATE TABLE `media_assets` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `size` INTEGER NOT NULL,
  `uploaderAdminId` VARCHAR(32) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `media_assets_createdAt_idx` (`createdAt`),
  INDEX `media_assets_uploaderAdminId_idx` (`uploaderAdminId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
