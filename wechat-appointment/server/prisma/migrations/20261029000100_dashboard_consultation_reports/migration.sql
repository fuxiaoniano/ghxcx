ALTER TABLE `consultation_forms`
  ADD COLUMN `appointmentScheduled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `paymentAmount` DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE `consultation_forms` AS f
JOIN `consultation_statuses` AS s ON s.id = f.statusId
SET f.appointmentScheduled = true
WHERE s.code IN ('VISITED', 'DEAL');

CREATE TABLE `admin_dashboard_preferences` (
  `adminUserId` VARCHAR(32) NOT NULL,
  `modulesJson` JSON NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`adminUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_dashboard_todos` (
  `id` VARCHAR(32) NOT NULL,
  `adminUserId` VARCHAR(32) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  `completed` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `adt_owner_due_ix`(`adminUserId`, `completed`, `dueAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
