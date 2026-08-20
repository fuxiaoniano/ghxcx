-- AlterTable
ALTER TABLE `appointments`
    ADD COLUMN `followupForwardStatus` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `followupForwardedAt` DATETIME(3) NULL,
    ADD COLUMN `followupForwardLastTriedAt` DATETIME(3) NULL,
    ADD COLUMN `followupForwardErrorCode` VARCHAR(64) NULL,
    ADD COLUMN `followupForwardErrorMessage` TEXT NULL,
    ADD COLUMN `followupForwardResponse` JSON NULL,
    ADD COLUMN `followupForwardRetryCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `appointments_followupForwardStatus_idx` ON `appointments`(`followupForwardStatus`);
