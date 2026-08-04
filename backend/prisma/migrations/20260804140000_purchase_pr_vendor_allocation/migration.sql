-- PR multi-vendor allocation: multiple planning rows per PR line, ordered qty tracking.
-- Idempotent — safe after partial apply (P3018 on DROP INDEX).

SELECT DATABASE() AS db_name, NOW() AS run_at;

SET @db = DATABASE();

-- purchase_requisition_lines.orderedQuantity
SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_lines' AND COLUMN_NAME = 'orderedQuantity'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_requisition_lines` ADD COLUMN `orderedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0',
  'SELECT ''purchase_requisition_lines.orderedQuantity exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Extend line status enum (ignore if already includes PARTIALLY_CONVERTED)
ALTER TABLE `purchase_requisition_lines`
  MODIFY COLUMN `status` ENUM('OPEN', 'PARTIALLY_CONVERTED', 'CANCELLED', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'OPEN';

-- purchase_planning_rows.allocatedQuantity
SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_planning_rows' AND COLUMN_NAME = 'allocatedQuantity'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_planning_rows` ADD COLUMN `allocatedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0',
  'SELECT ''purchase_planning_rows.allocatedQuantity exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_planning_rows' AND COLUMN_NAME = 'orderedQuantity'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_planning_rows` ADD COLUMN `orderedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0',
  'SELECT ''purchase_planning_rows.orderedQuantity exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `purchase_planning_rows`
SET `allocatedQuantity` = `netPurchaseQuantity`
WHERE `allocatedQuantity` = 0 AND `netPurchaseQuantity` > 0;

-- Drop FK first — MySQL cannot drop unique index while FK depends on it (error 1553).
SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'purchase_planning_rows'
    AND CONSTRAINT_NAME = 'purchase_planning_rows_purchaseRequisitionLineId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(
  @fk > 0,
  'ALTER TABLE `purchase_planning_rows` DROP FOREIGN KEY `purchase_planning_rows_purchaseRequisitionLineId_fkey`',
  'SELECT ''FK already dropped'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'purchase_planning_rows'
    AND INDEX_NAME = 'purchase_planning_rows_purchaseRequisitionLineId_key'
);
SET @sql = IF(
  @idx > 0,
  'DROP INDEX `purchase_planning_rows_purchaseRequisitionLineId_key` ON `purchase_planning_rows`',
  'SELECT ''unique idx purchaseRequisitionLineId_key already dropped'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'purchase_planning_rows'
    AND INDEX_NAME = 'purchase_planning_rows_tenantId_purchaseRequisitionLineId_key'
);
SET @sql = IF(
  @idx > 0,
  'DROP INDEX `purchase_planning_rows_tenantId_purchaseRequisitionLineId_key` ON `purchase_planning_rows`',
  'SELECT ''unique idx tenantId_purchaseRequisitionLineId_key already dropped'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Non-unique index for FK + multi-row per PR line lookups.
SET @idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'purchase_planning_rows'
    AND INDEX_NAME = 'purchase_planning_rows_purchaseRequisitionLineId_idx'
);
SET @sql = IF(
  @idx = 0,
  'CREATE INDEX `purchase_planning_rows_purchaseRequisitionLineId_idx` ON `purchase_planning_rows`(`purchaseRequisitionLineId`)',
  'SELECT ''purchaseRequisitionLineId_idx exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'purchase_planning_rows'
    AND CONSTRAINT_NAME = 'purchase_planning_rows_purchaseRequisitionLineId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_purchaseRequisitionLineId_fkey` FOREIGN KEY (`purchaseRequisitionLineId`) REFERENCES `purchase_requisition_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''FK already exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
