/* =========================================================
   PURCHASE PO API — complete idempotent schema fix (Hostinger / manual)
   Run when PurchaseOrder / PurchaseApproval return Prisma P2022.

   Order:
     1. This file (all purchase PO schema through 20260730100000)
     2. Restart Node backend
     3. live-deploy-purchase-schema-verify.sql (should show 0 missing)

   Change USE database name before running.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'purchase_po_api_complete' AS script;
SET @db := DATABASE();

/* ---------- PO lifecycle columns (20260721060000) ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='rejectedAt'),
  'SELECT 1',
  'ALTER TABLE purchase_orders ADD COLUMN rejectedAt DATETIME(3) NULL, ADD COLUMN rejectionReason TEXT NULL, ADD COLUMN sentBackAt DATETIME(3) NULL, ADD COLUMN sendBackReason TEXT NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='acceptedQuantity'),
  'SELECT 1',
  'ALTER TABLE purchase_order_lines ADD COLUMN acceptedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0, ADD COLUMN rejectedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0, ADD COLUMN returnedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0, ADD COLUMN invoicedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ---------- deliveryWarehouseId (20260721090000) ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryWarehouseId'),
  'SELECT 1',
  'ALTER TABLE purchase_orders ADD COLUMN deliveryWarehouseId VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ---------- multi-unit UOM (20260727180000) — see live-deploy-purchase-multi-unit-uom.sql for full pack; core PO line cols: ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='uomQuantity'),
  'SELECT 1',
  'ALTER TABLE purchase_order_lines ADD COLUMN uomQuantity DECIMAL(18,4) NOT NULL DEFAULT 0, ADD COLUMN uomConversionFactor DECIMAL(18,4) NOT NULL DEFAULT 1, ADD COLUMN unitCostPrimary DECIMAL(18,4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE purchase_order_lines SET uomQuantity = quantity WHERE uomQuantity = 0;

/* ---------- revisionNo + revisions table (20260728180000) ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='revisionNo'),
  'SELECT 1',
  'ALTER TABLE purchase_orders ADD COLUMN revisionNo INT NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `purchase_order_revisions` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `revisionNo` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `statusBefore` VARCHAR(40) NOT NULL,
  `statusAfter` VARCHAR(40) NOT NULL,
  `revisedById` VARCHAR(36) NULL,
  `revisedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `headerSnapshot` JSON NOT NULL,
  `linesSnapshot` JSON NOT NULL,
  `changes` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `purchase_order_revisions_tenantId_purchaseOrderId_revisionNo_key` (`tenantId`, `purchaseOrderId`, `revisionNo`),
  INDEX `purchase_order_revisions_tenantId_idx` (`tenantId`),
  INDEX `purchase_order_revisions_tenantId_purchaseOrderId_idx` (`tenantId`, `purchaseOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

/* ---------- requisitionNumber (20260729150000) ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='requisitionNumber'),
  'SELECT 1',
  'ALTER TABLE purchase_order_lines ADD COLUMN requisitionNumber VARCHAR(64) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ---------- tax/bin/QC snapshots (20260730100000) — per-column idempotent ---------- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='gstGroupId'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN gstGroupId VARCHAR(191) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='hsnId'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN hsnId VARCHAR(191) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='hsnCodeSnapshot'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN hsnCodeSnapshot VARCHAR(16) NOT NULL DEFAULT '''''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='gstGroupCodeSnapshot'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN gstGroupCodeSnapshot VARCHAR(32) NOT NULL DEFAULT '''''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='binId'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN binId VARCHAR(191) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='qcRequiredSnapshot'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN qcRequiredSnapshot BOOLEAN NOT NULL DEFAULT false'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='qualityTestGroupCodeSnapshot'),
  'SELECT 1', 'ALTER TABLE purchase_order_lines ADD COLUMN qualityTestGroupCodeSnapshot VARCHAR(32) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ---------- archive tables (20260729170000) — detail revise feature ---------- */
CREATE TABLE IF NOT EXISTS `purchase_order_archived` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `revisionNo` INT NOT NULL,
  `orderNumber` VARCHAR(64) NOT NULL,
  `orderDate` DATE NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `origin` ENUM('MANUAL','PURCHASE_REQUISITION','PLANNING_SHEET','RFQ_COMPARISON','OTHER') NOT NULL DEFAULT 'MANUAL',
  `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SENT_BACK','SENT_TO_VENDOR','PARTIALLY_RECEIVED','FULLY_RECEIVED','PARTIALLY_INVOICED','FULLY_INVOICED','CANCELLED','CLOSED') NOT NULL,
  `purchaseRequisitionId` VARCHAR(191) NULL,
  `requestForQuotationId` VARCHAR(191) NULL,
  `vendorQuotationId` VARCHAR(191) NULL,
  `vendorComparisonId` VARCHAR(191) NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `expectedDeliveryDate` DATE NULL,
  `paymentTerms` VARCHAR(200) NULL,
  `deliveryTerms` VARCHAR(200) NULL,
  `deliveryWarehouseId` VARCHAR(191) NULL,
  `subtotalAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `freightAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `totalAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `archivedById` VARCHAR(36) NULL,
  `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `purchase_order_archived_tenantId_purchaseOrderId_revisionNo_key`(`tenantId`,`purchaseOrderId`,`revisionNo`),
  INDEX `purchase_order_archived_tenantId_idx`(`tenantId`),
  INDEX `purchase_order_archived_tenantId_purchaseOrderId_idx`(`tenantId`,`purchaseOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_line_archived` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `archivedHeaderId` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `sourceLineId` VARCHAR(191) NULL,
  `revisionNo` INT NOT NULL,
  `lineNumber` INT NOT NULL,
  `purchaseRequisitionLineId` VARCHAR(191) NULL,
  `purchasePlanningRowId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NULL,
  `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
  `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
  `description` TEXT NULL,
  `quantity` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `uomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `uomConversionFactor` DECIMAL(18,4) NOT NULL DEFAULT 1,
  `unitCostPrimary` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `uomId` VARCHAR(191) NULL,
  `rate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `receivedQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `requiredDate` DATE NULL,
  `requisitionNumber` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `purchase_line_archived_tenantId_idx`(`tenantId`),
  INDEX `purchase_line_archived_tenantId_purchaseOrderId_idx`(`tenantId`,`purchaseOrderId`),
  INDEX `purchase_line_archived_tenantId_archivedHeaderId_idx`(`tenantId`,`archivedHeaderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'DONE — restart Node backend, then run live-deploy-purchase-schema-verify.sql' AS next_step;
