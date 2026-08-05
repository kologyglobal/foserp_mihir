-- GRN receiving condition + split weight receiving tolerance on items

ALTER TABLE `master_items`
  ADD COLUMN `weightReceivingToleranceId` VARCHAR(191) NULL AFTER `receivingToleranceId`;

CREATE INDEX `master_items_tenantId_weightReceivingToleranceId_idx`
  ON `master_items`(`tenantId`, `weightReceivingToleranceId`);

ALTER TABLE `master_items`
  ADD CONSTRAINT `master_items_weightReceivingToleranceId_fkey`
  FOREIGN KEY (`weightReceivingToleranceId`) REFERENCES `master_receiving_tolerances`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightReceivingToleranceIdSnapshot` VARCHAR(36) NULL AFTER `receivingTolerancePercentageSnapshot`,
  ADD COLUMN `weightReceivingToleranceCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '' AFTER `weightReceivingToleranceIdSnapshot`,
  ADD COLUMN `weightReceivingToleranceNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '' AFTER `weightReceivingToleranceCodeSnapshot`,
  ADD COLUMN `weightReceivingTolerancePercentageSnapshot` DECIMAL(8, 4) NOT NULL DEFAULT 0 AFTER `weightReceivingToleranceNameSnapshot`,
  ADD COLUMN `receivingCondition` ENUM('NORMAL', 'SHORT', 'EXCESS', 'DAMAGE', 'REJECTED', 'QUALITY_HOLD') NOT NULL DEFAULT 'NORMAL' AFTER `closeOpenQuantity`,
  ADD COLUMN `receivingConditionReason` TEXT NULL AFTER `receivingCondition`;
