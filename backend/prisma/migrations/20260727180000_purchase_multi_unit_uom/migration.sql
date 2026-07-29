-- Purchase multi-unit conversion: vendor UOM ↔ primary/stock UOM
-- quantity = primary; uomQuantity = vendor; uomConversionFactor = vendor units per 1 primary

-- MasterItem.uomConversionFactor (backfill from purchaseQtyPerUom)
ALTER TABLE `master_items`
  ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1;

UPDATE `master_items`
SET `uomConversionFactor` = CASE
  WHEN `purchaseQtyPerUom` IS NULL OR `purchaseQtyPerUom` <= 0 THEN 1
  ELSE `purchaseQtyPerUom`
END;

-- PurchaseOrderLine dual qty + cost snapshot
ALTER TABLE `purchase_order_lines`
  ADD COLUMN `uomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1,
  ADD COLUMN `unitCostPrimary` DECIMAL(18, 4) NOT NULL DEFAULT 0;

-- Safe backfill: existing quantity treated as both vendor and primary (factor 1)
UPDATE `purchase_order_lines`
SET
  `uomQuantity` = `quantity`,
  `uomConversionFactor` = 1,
  `unitCostPrimary` = `rate`
WHERE `uomQuantity` = 0;

-- GoodsReceiptLine dual qty + cost snapshot
ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1,
  ADD COLUMN `unitCostPrimary` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `orderedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `receivedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `acceptedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `rejectedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;

UPDATE `goods_receipt_lines`
SET
  `uomConversionFactor` = 1,
  `unitCostPrimary` = `rate`,
  `orderedUomQuantity` = `orderedQuantity`,
  `receivedUomQuantity` = `receivedQuantity`,
  `acceptedUomQuantity` = `acceptedQuantity`,
  `rejectedUomQuantity` = `rejectedQuantity`;

-- InventoryStockMovement optional vendor-UOM audit snapshots
ALTER TABLE `inventory_stock_movements`
  ADD COLUMN `uomQuantity` DECIMAL(18, 4) NULL,
  ADD COLUMN `uomId` VARCHAR(191) NULL,
  ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NULL;
