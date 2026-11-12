ALTER TABLE `promotion_arrival_patients`
  ADD COLUMN `visitType` VARCHAR(16) NOT NULL DEFAULT '初诊' AFTER `arrivalDate`;
