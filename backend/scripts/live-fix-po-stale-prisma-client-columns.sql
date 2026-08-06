/* =========================================================
   EMERGENCY UNBLOCK — stale Hostinger Prisma client (PO header + lines)

   phpMyAdmin-safe: NO DELIMITER / NO stored procedures (avoids #2014 out of sync).

   Run the ENTIRE file from line 1. Do NOT enable "foreign key checks" footer
   if phpMyAdmin appends broken SET FOREIGN_KEY_CHECKS = ON;

   Band-aid only — durable fix: deploy hostinger-start.mjs + prisma generate.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := DATABASE();

/* ── purchase_orders ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='paymentTermId'),
  'SELECT ''OK purchase_orders.paymentTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `paymentTermId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryTermId'),
  'SELECT ''OK purchase_orders.deliveryTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliveryTermId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='termsAndConditions'),
  'SELECT ''OK purchase_orders.termsAndConditions'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `termsAndConditions` TEXT NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='internalNotes'),
  'SELECT ''OK purchase_orders.internalNotes'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `internalNotes` TEXT NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='placeOfSupply'),
  'SELECT ''OK purchase_orders.placeOfSupply'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `placeOfSupply` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='placeOfSupplyStateCode'),
  'SELECT ''OK purchase_orders.placeOfSupplyStateCode'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `placeOfSupplyStateCode` VARCHAR(8) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='isInterstate'),
  'SELECT ''OK purchase_orders.isInterstate'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `isInterstate` BOOLEAN NOT NULL DEFAULT false'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='gstScheme'),
  'SELECT ''OK purchase_orders.gstScheme'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `gstScheme` VARCHAR(16) NOT NULL DEFAULT ''cgst_sgst'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='orderType'),
  'SELECT ''OK purchase_orders.orderType'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `orderType` VARCHAR(32) NOT NULL DEFAULT ''standard'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='department'),
  'SELECT ''OK purchase_orders.department'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `department` VARCHAR(100) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='validityDate'),
  'SELECT ''OK purchase_orders.validityDate'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `validityDate` DATE NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='freightTerms'),
  'SELECT ''OK purchase_orders.freightTerms'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `freightTerms` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='packingTerms'),
  'SELECT ''OK purchase_orders.packingTerms'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `packingTerms` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='insuranceTerms'),
  'SELECT ''OK purchase_orders.insuranceTerms'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `insuranceTerms` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='warranty'),
  'SELECT ''OK purchase_orders.warranty'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `warranty` VARCHAR(300) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='inspectionRequirement'),
  'SELECT ''OK purchase_orders.inspectionRequirement'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `inspectionRequirement` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='priceBasis'),
  'SELECT ''OK purchase_orders.priceBasis'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `priceBasis` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='purchaseLocationId'),
  'SELECT ''OK purchase_orders.purchaseLocationId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `purchaseLocationId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryLocationId'),
  'SELECT ''OK purchase_orders.deliveryLocationId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliveryLocationId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='buyerId'),
  'SELECT ''OK purchase_orders.buyerId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `buyerId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='requesterId'),
  'SELECT ''OK purchase_orders.requesterId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `requesterId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='approverId'),
  'SELECT ''OK purchase_orders.approverId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `approverId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='blanketOrderId'),
  'SELECT ''OK purchase_orders.blanketOrderId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `blanketOrderId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='lineDiscount'),
  'SELECT ''OK purchase_orders.lineDiscount'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `lineDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='tradeDiscount'),
  'SELECT ''OK purchase_orders.tradeDiscount'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `tradeDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='packingCharges'),
  'SELECT ''OK purchase_orders.packingCharges'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `packingCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='insuranceCharges'),
  'SELECT ''OK purchase_orders.insuranceCharges'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `insuranceCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='tcsAmount'),
  'SELECT ''OK purchase_orders.tcsAmount'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `tcsAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='discountAmount'),
  'SELECT ''OK purchase_orders.discountAmount'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='otherCharges'),
  'SELECT ''OK purchase_orders.otherCharges'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `otherCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='roundOff'),
  'SELECT ''OK purchase_orders.roundOff'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `roundOff` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='taxableAmount'),
  'SELECT ''OK purchase_orders.taxableAmount'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `taxableAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── purchase_order_lines ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='lineType'),
  'SELECT ''OK purchase_order_lines.lineType'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `lineType` VARCHAR(32) NOT NULL DEFAULT ''raw_material'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='itemType'),
  'SELECT ''OK purchase_order_lines.itemType'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `itemType` VARCHAR(32) NOT NULL DEFAULT ''raw_material'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='category'),
  'SELECT ''OK purchase_order_lines.category'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `category` VARCHAR(32) NOT NULL DEFAULT ''raw_material'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='productType'),
  'SELECT ''OK purchase_order_lines.productType'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `productType` VARCHAR(32) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='specification'),
  'SELECT ''OK purchase_order_lines.specification'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `specification` TEXT NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='sacCode'),
  'SELECT ''OK purchase_order_lines.sacCode'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `sacCode` VARCHAR(16) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='discountPct'),
  'SELECT ''OK purchase_order_lines.discountPct'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `discountPct` DECIMAL(9, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='discountAmount'),
  'SELECT ''OK purchase_order_lines.discountAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='taxAmount'),
  'SELECT ''OK purchase_order_lines.taxAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='taxableAmount'),
  'SELECT ''OK purchase_order_lines.taxableAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `taxableAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='cgstAmount'),
  'SELECT ''OK purchase_order_lines.cgstAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `cgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='sgstAmount'),
  'SELECT ''OK purchase_order_lines.sgstAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `sgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='igstAmount'),
  'SELECT ''OK purchase_order_lines.igstAmount'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `igstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='lineTotal'),
  'SELECT ''OK purchase_order_lines.lineTotal'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='deliverySchedule'),
  'SELECT ''OK purchase_order_lines.deliverySchedule'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `deliverySchedule` VARCHAR(200) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='warehouseId'),
  'SELECT ''OK purchase_order_lines.warehouseId'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `warehouseId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='locationId'),
  'SELECT ''OK purchase_order_lines.locationId'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `locationId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='costCentre'),
  'SELECT ''OK purchase_order_lines.costCentre'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `costCentre` VARCHAR(64) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='project'),
  'SELECT ''OK purchase_order_lines.project'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `project` VARCHAR(64) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='productionOrder'),
  'SELECT ''OK purchase_order_lines.productionOrder'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `productionOrder` VARCHAR(64) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='lineStatus'),
  'SELECT ''OK purchase_order_lines.lineStatus'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `lineStatus` VARCHAR(32) NOT NULL DEFAULT ''open'''
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='expectedDeliveryDate'),
  'SELECT ''OK purchase_order_lines.expectedDeliveryDate'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `expectedDeliveryDate` DATE NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='requestForQuotationLineId'),
  'SELECT ''OK purchase_order_lines.requestForQuotationLineId'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `requestForQuotationLineId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='vendorQuotationLineId'),
  'SELECT ''OK purchase_order_lines.vendorQuotationLineId'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `vendorQuotationLineId` VARCHAR(36) NULL'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='pendingQuantity'),
  'SELECT ''OK purchase_order_lines.pendingQuantity'' AS msg',
  'ALTER TABLE `purchase_order_lines` ADD COLUMN `pendingQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
)); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── Verify ── */
SELECT 'purchase_orders' AS tbl, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_orders'
  AND COLUMN_NAME IN ('paymentTermId', 'deliveryTermId', 'termsAndConditions', 'internalNotes')
ORDER BY COLUMN_NAME;

SELECT 'purchase_order_lines' AS tbl, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_order_lines'
  AND COLUMN_NAME IN ('lineType', 'itemType', 'category', 'discountPct', 'lineTotal', 'lineStatus')
ORDER BY COLUMN_NAME;

SELECT 'Stale PO prisma-client columns patched — retry PO list' AS status;
