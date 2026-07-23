-- Category stockability defaults (RM/BO/FG stockable; SFG optional; SERVICE non-stock).
ALTER TABLE `master_item_categories`
  ADD COLUMN `stockPolicy` VARCHAR(16) NOT NULL DEFAULT 'REQUIRED' AFTER `defaultWarehouseId`,
  ADD COLUMN `defaultIsStockable` BOOLEAN NOT NULL DEFAULT TRUE AFTER `stockPolicy`,
  ADD COLUMN `defaultInventoryType` VARCHAR(32) NOT NULL DEFAULT 'inventory' AFTER `defaultIsStockable`;
