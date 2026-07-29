/* =========================================================
   LIVE DEPLOY — Part B2 schema
   File: live-deploy-grn-receiving-tolerance.sql
   Migration: 20260728140000_grn_receiving_tolerance
   Order: 3rd (after multi-unit). Idempotent column adds.
   Enum MODIFY: safe if status values already in the new list.
   Run check script first if unsure about existing GRN statuses.
   ========================================================= */

USE `u233611619_fos_erp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'grn_receiving_tolerance' AS script;
SET @db := DATABASE();

/* master_items.receivingTolerancePercentage */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='receivingTolerancePercentage'),
  'SELECT ''OK master_items.receivingTolerancePercentage'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `receivingTolerancePercentage` DECIMAL(5,2) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* goods_receipts tolerance approval columns */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired'),
  'SELECT 1',
  'ALTER TABLE `goods_receipts` ADD COLUMN `toleranceApprovalRequired` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovedAt'),
  'SELECT 1',
  'ALTER TABLE `goods_receipts` ADD COLUMN `toleranceApprovedAt` DATETIME(3) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovedById'),
  'SELECT 1',
  'ALTER TABLE `goods_receipts` ADD COLUMN `toleranceApprovedById` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Expand goods_receipts.status enum (includes PENDING_TOLERANCE_APPROVAL) */
SET @needsGrnStatus := (
  SELECT CASE
    WHEN COLUMN_TYPE LIKE '%PENDING_TOLERANCE_APPROVAL%' THEN 0
    ELSE 1
  END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='status'
  LIMIT 1
);
SET @sql := IF(
  @needsGrnStatus = 1,
  'ALTER TABLE `goods_receipts` MODIFY COLUMN `status` ENUM(''DRAFT'',''PENDING_TOLERANCE_APPROVAL'',''SUBMITTED'',''RECEIVING_COMPLETED'',''QC_PENDING'',''PARTIALLY_ACCEPTED'',''FULLY_ACCEPTED'',''INVENTORY_POSTED'',''CANCELLED'',''REVERSED'',''CLOSED'') NOT NULL DEFAULT ''DRAFT''',
  'SELECT ''OK goods_receipts.status enum'' AS msg'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* goods_receipt_lines tolerance columns */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='tolerancePercentage'),
  'SELECT 1',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `tolerancePercentage` DECIMAL(5,2) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='variancePercentage'),
  'SELECT 1',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `variancePercentage` DECIMAL(9,4) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus'),
  'SELECT 1',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `toleranceStatus` ENUM(''OK'',''PARTIAL'',''NOT_RECEIVED'',''SHORT_OUTSIDE'',''EXCESS_WITHIN'',''EXCESS_OUTSIDE'') NOT NULL DEFAULT ''OK'''
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='closeOpenQuantity'),
  'SELECT 1',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `closeOpenQuantity` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Expand purchase_approvals.documentType to include GOODS_RECEIPT */
SET @needsApprDoc := (
  SELECT CASE
    WHEN COLUMN_TYPE LIKE '%GOODS_RECEIPT%' THEN 0
    ELSE 1
  END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approvals' AND COLUMN_NAME='documentType'
  LIMIT 1
);
SET @sql := IF(
  @needsApprDoc = 1,
  'ALTER TABLE `purchase_approvals` MODIFY COLUMN `documentType` ENUM(''PURCHASE_REQUISITION'',''PURCHASE_ORDER'',''REQUEST_FOR_QUOTATION'',''PURCHASE_PLANNING'',''GOODS_RECEIPT'') NOT NULL',
  'SELECT ''OK purchase_approvals.documentType enum'' AS msg'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='receivingTolerancePercentage') AS item_tol,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired') AS grn_tol_req,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus') AS line_tol_status,
  (SELECT CASE WHEN COLUMN_TYPE LIKE '%PENDING_TOLERANCE_APPROVAL%' THEN 1 ELSE 0 END
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='status') AS grn_status_enum_ok,
  (SELECT CASE WHEN COLUMN_TYPE LIKE '%GOODS_RECEIPT%' THEN 1 ELSE 0 END
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approvals' AND COLUMN_NAME='documentType') AS appr_doc_enum_ok;
