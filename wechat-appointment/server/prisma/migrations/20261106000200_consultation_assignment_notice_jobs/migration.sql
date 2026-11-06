CREATE TABLE `consultation_assignment_notice_jobs` (
  `id` VARCHAR(32) NOT NULL,
  `eventKey` VARCHAR(191) NOT NULL,
  `formId` VARCHAR(32) NOT NULL,
  `ownerAdminId` VARCHAR(32) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastErrorCode` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `consultation_assignment_notice_jobs_eventKey_key`(`eventKey`),
  INDEX `canj_status_available_ix`(`status`, `availableAt`, `createdAt`),
  INDEX `canj_form_created_ix`(`formId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canj_form_fk` FOREIGN KEY (`formId`) REFERENCES `consultation_forms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `canj_owner_fk` FOREIGN KEY (`ownerAdminId`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
