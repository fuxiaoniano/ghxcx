CREATE TABLE `consultation_schedules` (
  `id` VARCHAR(32) NOT NULL,
  `adminUserId` VARCHAR(32) NOT NULL,
  `workDate` DATE NOT NULL,
  `shift` VARCHAR(16) NOT NULL DEFAULT 'MORNING',
  `updatedById` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `consultation_schedules_adminUserId_workDate_key` (`adminUserId`, `workDate`),
  INDEX `consultation_schedules_workDate_idx` (`workDate`),
  CONSTRAINT `consultation_schedules_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
