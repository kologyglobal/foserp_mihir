/* =========================================================
   LIVE Purchase multi-unit UOM — Hostinger phpMyAdmin (idempotent)
   Migration: 20260727180000_purchase_multi_unit_uom
   ========================================================= */
SET @db := DATABASE();

/* MasterItem.uomConversionFactor */
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='uomConversionFactor'),
  'SELECT ''master_items.uomConversionFactor exists''',
  'ALTER TABLE `master_items` ADD COLUMN `uomConversionFactor` DECIMAL(18,4) NOT NULL DEFAULT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `master_items`
SET `uomConversionFactor` = CASE
  WHEN `purchaseQtyPerUom` IS NULL OR `purchaseQtyPerUom` <= 0 THEN 1
  ELSE `purchaseQtyPerUom`
END
WHERE `uomConversionFactor` = 1 AND `purchaseQtyPerUom` IS NOT NULL AND `purchaseQtyPerUom` > 0;

/* purchase_order_lines */
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='uomQuantity'),
  'SELECT 1', 'ALTER TABLE `purchase_order_lines` ADD COLUMN `uomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='uomConversionFactor'),
  'SELECT 1', 'ALTER TABLE `purchase_order_lines` ADD COLUMN `uomConversionFactor` DECIMAL(18,4) NOT NULL DEFAULT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='unitCostPrimary'),
  'SELECT 1', 'ALTER TABLE `purchase_order_lines` ADD COLUMN `unitCostPrimary` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `purchase_order_lines`
SET
  `uomQuantity` = CASE WHEN `uomQuantity` = 0 THEN `quantity` ELSE `uomQuantity` END,
  `uomConversionFactor` = CASE WHEN `uomConversionFactor` <= 0 THEN 1 ELSE `uomConversionFactor` END,
  `unitCostPrimary` = CASE WHEN `unitCostPrimary` = 0 THEN `rate` ELSE `unitCostPrimary` END;

/* goods_receipt_lines */
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='uomConversionFactor'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `uomConversionFactor` DECIMAL(18,4) NOT NULL DEFAULT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='unitCostPrimary'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `unitCostPrimary` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='orderedUomQuantity'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `orderedUomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='receivedUomQuantity'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `receivedUomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='acceptedUomQuantity'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `acceptedUomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='rejectedUomQuantity'),
  'SELECT 1', 'ALTER TABLE `goods_receipt_lines` ADD COLUMN `rejectedUomQuantity` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `goods_receipt_lines`
SET
  `uomConversionFactor` = CASE WHEN `uomConversionFactor` <= 0 THEN 1 ELSE `uomConversionFactor` END,
  `unitCostPrimary` = CASE WHEN `unitCostPrimary` = 0 THEN `rate` ELSE `unitCostPrimary` END,
  `orderedUomQuantity` = CASE WHEN `orderedUomQuantity` = 0 THEN `orderedQuantity` ELSE `orderedUomQuantity` END,
  `receivedUomQuantity` = CASE WHEN `receivedUomQuantity` = 0 THEN `receivedQuantity` ELSE `receivedUomQuantity` END,
  `acceptedUomQuantity` = CASE WHEN `acceptedUomQuantity` = 0 THEN `acceptedQuantity` ELSE `acceptedUomQuantity` END,
  `rejectedUomQuantity` = CASE WHEN `rejectedUomQuantity` = 0 THEN `rejectedQuantity` ELSE `rejectedUomQuantity` END;

/* inventory_stock_movements optional snapshots */
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_movements' AND COLUMN_NAME='uomQuantity'),
  'SELECT 1', 'ALTER TABLE `inventory_stock_movements` ADD COLUMN `uomQuantity` DECIMAL(18,4) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_movements' AND COLUMN_NAME='uomId'),
  'SELECT 1', 'ALTER TABLE `inventory_stock_movements` ADD COLUMN `uomId` VARCHAR(191) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_movements' AND COLUMN_NAME='uomConversionFactor'),
  'SELECT 1', 'ALTER TABLE `inventory_stock_movements` ADD COLUMN `uomConversionFactor` DECIMAL(18,4) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES
(UUID(),'manual-live-repair',NOW(3),'20260727180000_purchase_multi_unit_uom',NULL,NULL,NOW(3),1);

SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='uomConversionFactor') AS item_factor,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='uomQuantity') AS po_uom_qty,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='receivedUomQuantity') AS grn_uom_qty,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_movements' AND COLUMN_NAME='uomQuantity') AS mov_uom_qty;
