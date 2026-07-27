-- Inventory costing Phase A foundation (additive only).
-- Introduces InventoryCostEntry ledger linked 1:1 with InventoryStockMovement.
-- No physical stock behavior changes in this migration.

CREATE TABLE `inventory_cost_entries` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `inventoryMovementId` VARCHAR(191) NOT NULL,
  `entryType` ENUM('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'OPENING') NOT NULL,
  `valuationMethod` ENUM('FIFO', 'MOVING_WEIGHTED_AVERAGE', 'STANDARD_COST', 'SPECIFIC_IDENTIFICATION') NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL,
  `totalCost` DECIMAL(18, 2) NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `postingDate` DATETIME(3) NOT NULL,
  `sourceType` VARCHAR(64) NOT NULL,
  `sourceId` VARCHAR(191) NULL,
  `sourceLineId` VARCHAR(191) NULL,
  `lotId` VARCHAR(191) NULL,
  `serialId` VARCHAR(191) NULL,
  `workOrderId` VARCHAR(191) NULL,
  `costLayerId` VARCHAR(191) NULL,
  `costCalculationReference` VARCHAR(191) NULL,
  `reversalOfId` VARCHAR(191) NULL,
  `correctionOfId` VARCHAR(191) NULL,
  `isReversal` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(32) NOT NULL DEFAULT 'POSTED',
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `inv_cost_entry_tenant_movement_uidx` (`tenantId`, `inventoryMovementId`),
  INDEX `inv_cost_entry_tenant_date_idx` (`tenantId`, `postingDate`),
  INDEX `inv_cost_entry_tenant_item_wh_idx` (`tenantId`, `itemId`, `warehouseId`),
  INDEX `inv_cost_entry_tenant_method_idx` (`tenantId`, `valuationMethod`),
  INDEX `inv_cost_entry_tenant_le_idx` (`tenantId`, `legalEntityId`),
  CONSTRAINT `inv_cost_entry_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_le_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_item_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_warehouse_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_movement_fkey` FOREIGN KEY (`inventoryMovementId`) REFERENCES `inventory_stock_movements` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_lot_fkey` FOREIGN KEY (`lotId`) REFERENCES `inventory_lots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_entry_serial_fkey` FOREIGN KEY (`serialId`) REFERENCES `inventory_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

