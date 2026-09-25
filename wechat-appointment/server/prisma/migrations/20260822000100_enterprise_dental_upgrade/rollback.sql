-- Manual rollback for 20260822000100_enterprise_dental_upgrade.
-- Back up rows where type <> 'LEGACY_REGISTRATION' before executing.

ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_packageId_fkey`;
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_dentalProjectId_fkey`;
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_dentalCategoryId_fkey`;
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_doctorId_fkey`;

DROP INDEX `appointments_appointmentDate_idx` ON `appointments`;
DROP INDEX `appointments_packageId_idx` ON `appointments`;
DROP INDEX `appointments_dentalProjectId_idx` ON `appointments`;
DROP INDEX `appointments_dentalCategoryId_idx` ON `appointments`;
DROP INDEX `appointments_doctorId_idx` ON `appointments`;
DROP INDEX `appointments_type_idx` ON `appointments`;

ALTER TABLE `appointments`
    DROP COLUMN `gender`,
    DROP COLUMN `symptomDescription`,
    DROP COLUMN `appointmentTime`,
    DROP COLUMN `appointmentDate`,
    DROP COLUMN `packageId`,
    DROP COLUMN `dentalProjectId`,
    DROP COLUMN `dentalCategoryId`,
    DROP COLUMN `doctorId`,
    DROP COLUMN `type`;

DROP TABLE `package_images`;
DROP TABLE `packages`;
DROP TABLE `package_categories`;
DROP TABLE `doctor_schedules`;
DROP TABLE `doctors`;
DROP TABLE `dental_projects`;
DROP TABLE `dental_categories`;
DROP TABLE `home_ads`;
DROP TABLE `home_banners`;
