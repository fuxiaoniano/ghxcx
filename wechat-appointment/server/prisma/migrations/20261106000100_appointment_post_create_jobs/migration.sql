CREATE TABLE `appointment_post_create_jobs` (
  `id` VARCHAR(32) NOT NULL,
  `appointmentId` VARCHAR(32) NOT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastErrorCode` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `apcj_appointment_kind_uq`(`appointmentId`, `kind`),
  INDEX `apcj_status_available_ix`(`status`, `availableAt`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `apcj_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
