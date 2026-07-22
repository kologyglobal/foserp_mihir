-- Inventory moving-average valuation.

ALTER TABLE `inventory_stock_balances`
  ADD COLUMN `avgRate` DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN `stockValue` DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE `manufacturing_costing_policies`
  ADD COLUMN `inventoryValuationMethod` ENUM('MOVING_AVERAGE','FIFO')
  NOT NULL DEFAULT 'MOVING_AVERAGE';
