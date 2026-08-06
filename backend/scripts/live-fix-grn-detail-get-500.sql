/* =========================================================
   LIVE FIX — GET /purchase/grns/:id → 500 (code null)

   Covers full detail path:
     goodsReceipt + lines + PO include
     summarizeMaterialReturnsForGrn → purchase_returns / QI

   phpMyAdmin: select u233611619_foserp, paste ENTIRE file, Go.
   Safe to re-run (PREPARE skips existing columns).
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := 'u233611619_foserp';
SET @grn_id := '6e2c9d57-debc-4598-bec1-5450f63a5637';

/* ── A) Diagnostic for this GRN ── */
SELECT id, grnNumber, status, purchaseOrderId, deletedAt
FROM goods_receipts WHERE id = @grn_id;

SELECT lineNumber,
  CAST(toleranceStatus AS CHAR(64)) AS toleranceStatus_raw,
  CAST(weightToleranceStatus AS CHAR(64)) AS weight_tol_raw,
  CAST(receivingCondition AS CHAR(64)) AS receiving_condition_raw
FROM goods_receipt_lines
WHERE goodsReceiptId = @grn_id
ORDER BY lineNumber;

SELECT 'bad_tolerance_on_grn' AS issue, lineNumber, CAST(toleranceStatus AS CHAR(64)) AS val
FROM goods_receipt_lines
WHERE goodsReceiptId = @grn_id
  AND CAST(toleranceStatus AS CHAR(64)) NOT IN (
    'NOT_RECEIVED','PARTIAL','EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
  );

/* ── B) goods_receipt_lines — receiving condition + weight tolerance (20260805120000) ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='weightReceivingToleranceIdSnapshot'),
  'SELECT ''OK weightReceivingToleranceIdSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `weightReceivingToleranceIdSnapshot` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='weightReceivingToleranceCodeSnapshot'),
  'SELECT ''OK weightReceivingToleranceCodeSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `weightReceivingToleranceCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='weightReceivingToleranceNameSnapshot'),
  'SELECT ''OK weightReceivingToleranceNameSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `weightReceivingToleranceNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='weightReceivingTolerancePercentageSnapshot'),
  'SELECT ''OK weightReceivingTolerancePercentageSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `weightReceivingTolerancePercentageSnapshot` DECIMAL(8, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='receivingCondition'),
  'SELECT ''OK receivingCondition'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `receivingCondition` ENUM(''NORMAL'',''SHORT'',''EXCESS'',''DAMAGE'',''REJECTED'',''QUALITY_HOLD'') NOT NULL DEFAULT ''NORMAL'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='receivingConditionReason'),
  'SELECT ''OK receivingConditionReason'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `receivingConditionReason` TEXT NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── C) goods_receipt_lines — tax snapshots (20260805140000) ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='hsnIdSnapshot'),
  'SELECT ''OK hsnIdSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='hsnCodeSnapshot'),
  'SELECT ''OK hsnCodeSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='gstGroupIdSnapshot'),
  'SELECT ''OK gstGroupIdSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='gstGroupCodeSnapshot'),
  'SELECT ''OK gstGroupCodeSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='gstRatePctSnapshot'),
  'SELECT ''OK gstRatePctSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='cgstRateSnapshot'),
  'SELECT ''OK cgstRateSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='sgstRateSnapshot'),
  'SELECT ''OK sgstRateSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='igstRateSnapshot'),
  'SELECT ''OK igstRateSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='gstSchemeSnapshot'),
  'SELECT ''OK gstSchemeSnapshot'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT ''cgst_sgst'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── D) purchase_return_lines tax snapshots ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='hsnIdSnapshot'),
  'SELECT ''OK prl hsnIdSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='hsnCodeSnapshot'),
  'SELECT ''OK prl hsnCodeSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='gstGroupIdSnapshot'),
  'SELECT ''OK prl gstGroupIdSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='gstGroupCodeSnapshot'),
  'SELECT ''OK prl gstGroupCodeSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='gstRatePctSnapshot'),
  'SELECT ''OK prl gstRatePctSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='cgstRateSnapshot'),
  'SELECT ''OK prl cgstRateSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='sgstRateSnapshot'),
  'SELECT ''OK prl sgstRateSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='igstRateSnapshot'),
  'SELECT ''OK prl igstRateSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_return_lines' AND COLUMN_NAME='gstSchemeSnapshot'),
  'SELECT ''OK prl gstSchemeSnapshot'' AS msg',
  'ALTER TABLE `purchase_return_lines` ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT ''cgst_sgst'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── E) purchase_quality_inspections (QI path in GET detail) ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='result'),
  'SELECT ''OK qi result'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `result` VARCHAR(32) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='priority'),
  'SELECT ''OK qi priority'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `priority` VARCHAR(16) NOT NULL DEFAULT ''NORMAL'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='decisionCode'),
  'SELECT ''OK qi decisionCode'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `decisionCode` VARCHAR(40) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='decisionReason'),
  'SELECT ''OK qi decisionReason'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `decisionReason` TEXT NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='inspectionPlanId'),
  'SELECT ''OK qi inspectionPlanId'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `inspectionPlanId` VARCHAR(191) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='inspectionPlanRevisionId'),
  'SELECT ''OK qi inspectionPlanRevisionId'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `inspectionPlanRevisionId` VARCHAR(191) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='planCodeSnapshot'),
  'SELECT ''OK qi planCodeSnapshot'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `planCodeSnapshot` VARCHAR(64) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='planRevisionSnapshot'),
  'SELECT ''OK qi planRevisionSnapshot'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `planRevisionSnapshot` VARCHAR(32) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='assignedAt'),
  'SELECT ''OK qi assignedAt'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `assignedAt` DATETIME(3) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_quality_inspections' AND COLUMN_NAME='startedAt'),
  'SELECT ''OK qi startedAt'' AS msg',
  'ALTER TABLE `purchase_quality_inspections` ADD COLUMN `startedAt` DATETIME(3) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── F) Enum data fix (Prisma cannot read legacy toleranceStatus) ── */

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'OK','PARTIAL','NOT_RECEIVED','SHORT_OUTSIDE','EXCESS_WITHIN','EXCESS_OUTSIDE',
    'EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXACT' WHERE `toleranceStatus` = 'OK';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_WITHIN_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_WITHIN';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_OUTSIDE';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'PARTIAL' WHERE `toleranceStatus` = 'SHORT_OUTSIDE';

UPDATE `goods_receipt_lines`
SET `toleranceStatus` = 'EXACT'
WHERE CAST(`toleranceStatus` AS CHAR(64)) NOT IN (
  'NOT_RECEIVED','PARTIAL','EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
);

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'NOT_RECEIVED','PARTIAL','EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `approvalReasons` = JSON_ARRAY() WHERE `approvalReasons` IS NULL;

/* ── G) Verify this GRN ── */
SELECT 'bad_tolerance_after' AS check_item, COUNT(*) AS cnt
FROM goods_receipt_lines
WHERE goodsReceiptId = @grn_id
  AND CAST(toleranceStatus AS CHAR(64)) NOT IN (
    'NOT_RECEIVED','PARTIAL','EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
  );

SELECT 'GRN detail GET fix done — retry API; if still 500 deploy hostinger-start.mjs + restart' AS status;
