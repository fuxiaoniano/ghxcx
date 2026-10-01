CREATE TABLE `website_visitor_daily` (
  `id` VARCHAR(32) NOT NULL,
  `visitorHash` VARCHAR(64) NOT NULL,
  `statDate` DATE NOT NULL,
  `viewCount` INTEGER NOT NULL DEFAULT 1,
  `firstPath` VARCHAR(255) NULL,
  `lastPath` VARCHAR(255) NULL,
  `firstVisitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastVisitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `website_visitor_daily_visitorHash_statDate_key`(`visitorHash`, `statDate`),
  INDEX `website_visitor_daily_statDate_idx`(`statDate`),
  INDEX `website_visitor_daily_visitorHash_idx`(`visitorHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
