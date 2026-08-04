-- Supplier Quality Closure & Commercial Settlement

-- Purchase QI disposition decision
ALTER TABLE `purchase_quality_inspections`
  ADD COLUMN `decisionCode` VARCHAR(40) NULL,
  ADD COLUMN `decisionReason` TEXT NULL;

-- Purchase Return commercial + replacement linkage
ALTER TABLE `purchase_returns`
  ADD COLUMN `returnType` VARCHAR(32) NOT NULL DEFAULT 'CREDIT',
  ADD COLUMN `decisionCode` VARCHAR(40) NULL,
  ADD COLUMN `replacementGoodsReceiptId` VARCHAR(36) NULL,
  ADD COLUMN `replacedReturnId` VARCHAR(36) NULL,
  ADD COLUMN `ncrId` VARCHAR(36) NULL,
  ADD COLUMN `accountingStatus` VARCHAR(24) NOT NULL DEFAULT 'NONE',
  ADD COLUMN `shippedAt` DATETIME(3) NULL;

CREATE INDEX `purchase_returns_tenantId_returnType_idx`
  ON `purchase_returns`(`tenantId`, `returnType`);
CREATE INDEX `purchase_returns_tenantId_qualityInspectionId_idx`
  ON `purchase_returns`(`tenantId`, `qualityInspectionId`);
CREATE INDEX `purchase_returns_tenantId_replacedReturnId_idx`
  ON `purchase_returns`(`tenantId`, `replacedReturnId`);
CREATE INDEX `purchase_returns_tenantId_accountingStatus_idx`
  ON `purchase_returns`(`tenantId`, `accountingStatus`);
