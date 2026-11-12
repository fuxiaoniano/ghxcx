CREATE TABLE `admin_role_definitions` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `permissionsJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `admin_role_definitions_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `admin_users` ADD COLUMN `customRoleId` VARCHAR(32) NULL;
CREATE INDEX `admin_users_customRoleId_idx` ON `admin_users`(`customRoleId`);
ALTER TABLE `admin_users`
  ADD CONSTRAINT `admin_users_customRoleId_fkey`
  FOREIGN KEY (`customRoleId`) REFERENCES `admin_role_definitions`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
