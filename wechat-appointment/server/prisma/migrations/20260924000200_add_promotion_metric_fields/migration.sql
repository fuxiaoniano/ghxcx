CREATE TABLE `promotion_metric_fields` (
  `id` VARCHAR(32) NOT NULL,
  `key` VARCHAR(80) NOT NULL,
  `label` VARCHAR(80) NOT NULL,
  `source` VARCHAR(16) NOT NULL,
  `dataType` VARCHAR(16) NOT NULL DEFAULT 'NUMBER',
  `isVisible` BOOLEAN NOT NULL DEFAULT true,
  `sort` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `promotion_metric_fields_key_key`(`key`),
  INDEX `promotion_metric_fields_sort_idx`(`sort`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
