-- Enterprise dental mini-program upgrade.
-- This migration is additive: legacy tables and columns are preserved.

CREATE TABLE `home_banners` (
    `id` VARCHAR(32) NOT NULL,
    `imageUrl` VARCHAR(500) NOT NULL,
    `title` VARCHAR(120) NOT NULL DEFAULT '',
    `linkType` VARCHAR(32) NOT NULL DEFAULT 'NONE',
    `linkValue` VARCHAR(500) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `home_banners_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `home_ads` (
    `id` VARCHAR(32) NOT NULL,
    `imageUrl` VARCHAR(500) NOT NULL,
    `title` VARCHAR(120) NOT NULL DEFAULT '',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `home_ads_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dental_categories` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `dental_categories_name_key`(`name`),
    INDEX `dental_categories_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dental_projects` (
    `id` VARCHAR(32) NOT NULL,
    `categoryId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `dental_projects_categoryId_name_key`(`categoryId`, `name`),
    INDEX `dental_projects_categoryId_status_sort_idx`(`categoryId`, `status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `doctors` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `avatar` VARCHAR(500) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `departmentId` VARCHAR(32) NOT NULL,
    `clinicId` VARCHAR(32) NULL,
    `specialty` TEXT NOT NULL,
    `description` TEXT NOT NULL,
    `images` JSON NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `recommend` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `doctors_departmentId_status_sort_idx`(`departmentId`, `status`, `sort`),
    INDEX `doctors_clinicId_idx`(`clinicId`),
    INDEX `doctors_recommend_status_sort_idx`(`recommend`, `status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `doctor_schedules` (
    `id` VARCHAR(32) NOT NULL,
    `doctorId` VARCHAR(32) NOT NULL,
    `clinicId` VARCHAR(32) NULL,
    `date` DATE NOT NULL,
    `timeSlot` VARCHAR(32) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `bookedCount` INTEGER NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('AVAILABLE', 'FULL', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `doctor_schedules_doctorId_date_timeSlot_key`(`doctorId`, `date`, `timeSlot`),
    INDEX `doctor_schedules_date_status_idx`(`date`, `status`),
    INDEX `doctor_schedules_clinicId_idx`(`clinicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `package_categories` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `package_categories_name_key`(`name`),
    INDEX `package_categories_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `packages` (
    `id` VARCHAR(32) NOT NULL,
    `categoryId` VARCHAR(32) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `cover` VARCHAR(500) NOT NULL,
    `originalPrice` DECIMAL(10, 2) NOT NULL,
    `salePrice` DECIMAL(10, 2) NOT NULL,
    `salesCount` INTEGER NOT NULL DEFAULT 0,
    `description` LONGTEXT NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `packages_categoryId_status_sort_idx`(`categoryId`, `status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `package_images` (
    `id` VARCHAR(32) NOT NULL,
    `packageId` VARCHAR(32) NOT NULL,
    `imageUrl` VARCHAR(500) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `package_images_packageId_sort_idx`(`packageId`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `appointments`
    ADD COLUMN `type` ENUM('LEGACY_REGISTRATION', 'DOCTOR_APPOINTMENT', 'PACKAGE_APPLICATION') NOT NULL DEFAULT 'LEGACY_REGISTRATION',
    ADD COLUMN `doctorId` VARCHAR(32) NULL,
    ADD COLUMN `dentalCategoryId` VARCHAR(32) NULL,
    ADD COLUMN `dentalProjectId` VARCHAR(32) NULL,
    ADD COLUMN `packageId` VARCHAR(32) NULL,
    ADD COLUMN `appointmentDate` DATE NULL,
    ADD COLUMN `appointmentTime` VARCHAR(32) NULL,
    ADD COLUMN `symptomDescription` TEXT NULL,
    ADD COLUMN `gender` VARCHAR(16) NULL;

CREATE INDEX `appointments_type_idx` ON `appointments`(`type`);
CREATE INDEX `appointments_doctorId_idx` ON `appointments`(`doctorId`);
CREATE INDEX `appointments_dentalCategoryId_idx` ON `appointments`(`dentalCategoryId`);
CREATE INDEX `appointments_dentalProjectId_idx` ON `appointments`(`dentalProjectId`);
CREATE INDEX `appointments_packageId_idx` ON `appointments`(`packageId`);
CREATE INDEX `appointments_appointmentDate_idx` ON `appointments`(`appointmentDate`);

ALTER TABLE `dental_projects` ADD CONSTRAINT `dental_projects_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `dental_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `doctors` ADD CONSTRAINT `doctors_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `dental_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `doctors` ADD CONSTRAINT `doctors_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `doctor_schedules` ADD CONSTRAINT `doctor_schedules_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `doctor_schedules` ADD CONSTRAINT `doctor_schedules_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `packages` ADD CONSTRAINT `packages_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `package_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `package_images` ADD CONSTRAINT `package_images_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_dentalCategoryId_fkey` FOREIGN KEY (`dentalCategoryId`) REFERENCES `dental_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_dentalProjectId_fkey` FOREIGN KEY (`dentalProjectId`) REFERENCES `dental_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
