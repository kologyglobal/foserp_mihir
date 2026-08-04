/* =========================================================
   LIVE FIX — GET /purchase/grns → 500 (Hostinger-safe)
   NO information_schema, NO PREPARE.

   phpMyAdmin: select u233611619_foserp → paste ONE section → Go.
   Ignore #1060 Duplicate column / Duplicate key name.
   Empty result set on ALTER/UPDATE/CREATE INDEX = success.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

/* ── A) goods_receipts header ── */

ALTER TABLE `goods_receipts`
  ADD COLUMN `toleranceApprovalRequired` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `goods_receipts`
  ADD COLUMN `toleranceApprovedAt` DATETIME(3) NULL;

ALTER TABLE `goods_receipts`
  ADD COLUMN `toleranceApprovedById` VARCHAR(36) NULL;

ALTER TABLE `goods_receipts`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'PENDING_TOLERANCE_APPROVAL',
    'SUBMITTED',
    'RECEIVING_COMPLETED',
    'QC_PENDING',
    'PARTIALLY_ACCEPTED',
    'FULLY_ACCEPTED',
    'INVENTORY_POSTED',
    'CANCELLED',
    'REVERSED',
    'CLOSED'
  ) NOT NULL DEFAULT 'DRAFT';

/* ── B) goods_receipt_lines — tolerance base (20260728140000) ── */

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `tolerancePercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `variancePercentage` DECIMAL(9, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `toleranceStatus` ENUM(
    'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `closeOpenQuantity` BOOLEAN NOT NULL DEFAULT false;

/* ── C) goods_receipt_lines — UOM dual qty (20260727180000) ── */

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `unitCostPrimary` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `orderedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `acceptedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `rejectedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

UPDATE `goods_receipt_lines`
SET
  `uomConversionFactor` = 1,
  `unitCostPrimary` = `rate`,
  `orderedUomQuantity` = `orderedQuantity`,
  `receivedUomQuantity` = `receivedQuantity`,
  `acceptedUomQuantity` = `acceptedQuantity`,
  `rejectedUomQuantity` = `rejectedQuantity`
WHERE `orderedUomQuantity` = 0 AND `orderedQuantity` <> 0;

/* ── D) Migrate legacy toleranceStatus values (20260801100000) ── */

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'OK', 'PARTIAL', 'NOT_RECEIVED', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE',
    'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXACT' WHERE `toleranceStatus` = 'OK';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_WITHIN_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_WITHIN';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_OUTSIDE';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'PARTIAL' WHERE `toleranceStatus` = 'SHORT_OUTSIDE';

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

/* ── E) Receiving tolerance snapshots (20260801100000) ── */

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivingToleranceIdSnapshot` VARCHAR(36) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivingToleranceCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivingToleranceNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivingTolerancePercentageSnapshot` DECIMAL(8, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `maximumAllowedUnitQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `unitVariance` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `receivedWeight` DECIMAL(18, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `expectedWeight` DECIMAL(18, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `maximumAllowedWeight` DECIMAL(18, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightVariance` DECIMAL(18, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightVariancePercentage` DECIMAL(9, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightConversionRateSnapshot` DECIMAL(18, 4) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightUomIdSnapshot` VARCHAR(36) NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightUomCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `manualUnitEntry` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `manualWeightEntry` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `weightToleranceStatus` ENUM(
    'NOT_APPLICABLE', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'NOT_APPLICABLE';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `requiresApproval` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `approvalReasons` JSON NOT NULL DEFAULT (JSON_ARRAY());

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `shortCloseRequested` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `shortCloseReason` TEXT NULL;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `inventoryLotId` VARCHAR(191) NULL;

UPDATE `goods_receipt_lines` SET `approvalReasons` = JSON_ARRAY() WHERE `approvalReasons` IS NULL;

UPDATE `goods_receipt_lines`
SET `requiresApproval` = true,
    `approvalReasons` = JSON_ARRAY('UNIT_OVER_TOLERANCE')
WHERE `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE';

UPDATE `goods_receipt_lines`
SET `shortCloseRequested` = true
WHERE `closeOpenQuantity` = true;

SELECT 'GRN hostinger fix complete — retry GET /purchase/grns' AS status;
