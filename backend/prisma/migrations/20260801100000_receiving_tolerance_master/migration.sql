-- Receiving Tolerance Master + item FK + GRN unit/weight validation snapshots

CREATE TABLE `master_receiving_tolerances` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `percentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `master_receiving_tolerances_tenantId_code_key`(`tenantId`, `code`),
  INDEX `master_receiving_tolerances_tenantId_idx`(`tenantId`),
  INDEX `master_receiving_tolerances_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `master_receiving_tolerances_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `master_items`
  ADD COLUMN `receivingToleranceId` VARCHAR(191) NULL,
  ADD COLUMN `receiptEntryMode` ENUM('UNIT_ONLY', 'WEIGHT_ONLY', 'UNIT_AND_WEIGHT') NOT NULL DEFAULT 'UNIT_ONLY',
  ADD COLUMN `conversionCalculationMode` ENUM('AUTOMATIC', 'MANUAL') NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN `allowManualUnitQuantity` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `allowManualWeightQuantity` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requireWeightAtReceipt` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `weightUomId` VARCHAR(191) NULL,
  ADD COLUMN `standardWeightPerBaseUnit` DECIMAL(18, 4) NOT NULL DEFAULT 0;

CREATE INDEX `master_items_tenantId_receivingToleranceId_idx` ON `master_items`(`tenantId`, `receivingToleranceId`);
CREATE INDEX `master_items_tenantId_weightUomId_idx` ON `master_items`(`tenantId`, `weightUomId`);

ALTER TABLE `master_items`
  ADD CONSTRAINT `master_items_receivingToleranceId_fkey`
    FOREIGN KEY (`receivingToleranceId`) REFERENCES `master_receiving_tolerances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `master_items_weightUomId_fkey`
    FOREIGN KEY (`weightUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Expand tolerance enum (add new values alongside legacy)
ALTER TABLE `goods_receipt_lines`
  MODIFY `toleranceStatus` ENUM(
    'OK', 'PARTIAL', 'NOT_RECEIVED', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE',
    'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXACT' WHERE `toleranceStatus` = 'OK';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_WITHIN_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_WITHIN';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_OUTSIDE';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'PARTIAL' WHERE `toleranceStatus` = 'SHORT_OUTSIDE';

ALTER TABLE `goods_receipt_lines`
  MODIFY `toleranceStatus` ENUM(
    'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

ALTER TABLE `goods_receipt_lines`
  MODIFY `tolerancePercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `receivingToleranceIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `receivingToleranceCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `receivingToleranceNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN `receivingTolerancePercentageSnapshot` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `maximumAllowedUnitQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `unitVariance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `receivedWeight` DECIMAL(18, 4) NULL,
  ADD COLUMN `expectedWeight` DECIMAL(18, 4) NULL,
  ADD COLUMN `maximumAllowedWeight` DECIMAL(18, 4) NULL,
  ADD COLUMN `weightVariance` DECIMAL(18, 4) NULL,
  ADD COLUMN `weightVariancePercentage` DECIMAL(9, 4) NULL,
  ADD COLUMN `weightConversionRateSnapshot` DECIMAL(18, 4) NULL,
  ADD COLUMN `weightUomIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `weightUomCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `manualUnitEntry` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `manualWeightEntry` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `weightToleranceStatus` ENUM('NOT_APPLICABLE', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE') NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `approvalReasons` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  ADD COLUMN `shortCloseRequested` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `shortCloseReason` TEXT NULL;

UPDATE `goods_receipt_lines` SET `approvalReasons` = '[]' WHERE `approvalReasons` IS NULL;

UPDATE `goods_receipt_lines`
SET `requiresApproval` = true,
    `approvalReasons` = JSON_ARRAY('UNIT_OVER_TOLERANCE')
WHERE `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE';

UPDATE `goods_receipt_lines`
SET `shortCloseRequested` = `closeOpenQuantity`
WHERE `closeOpenQuantity` = true;
