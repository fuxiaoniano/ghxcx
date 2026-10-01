ALTER TABLE `consultation_forms`
  MODIFY `projectId` VARCHAR(32) NULL,
  ADD COLUMN `promotionAccountId` VARCHAR(32) NULL;

CREATE INDEX `consultation_forms_promotionAccountId_idx`
  ON `consultation_forms`(`promotionAccountId`);

ALTER TABLE `consultation_forms`
  ADD CONSTRAINT `consultation_forms_promotionAccountId_fkey`
  FOREIGN KEY (`promotionAccountId`) REFERENCES `promotion_accounts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
