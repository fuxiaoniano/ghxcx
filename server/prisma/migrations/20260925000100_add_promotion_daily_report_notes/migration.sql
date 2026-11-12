CREATE TABLE `promotion_daily_report_notes` (
  `id` VARCHAR(32) NOT NULL,
  `statDate` DATE NOT NULL,
  `project` VARCHAR(120) NOT NULL,
  `channel` VARCHAR(80) NOT NULL,
  `problem` VARCHAR(500) NOT NULL,
  `adjustment` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `promotion_daily_report_notes_statDate_project_channel_key`(`statDate`, `project`, `channel`),
  INDEX `promotion_daily_report_notes_statDate_idx`(`statDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
