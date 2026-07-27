-- Inventory costing Phase B — FIFO cost layers + consumption links.
-- Additive tables only; no changes to existing physical stock ledger behavior schemas besides new valuation persistence.

CREATE TABLE `inventory_cost_layers` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `lotId` VARCHAR(191) NULL,
  `serialId` VARCHAR(191) NULL,
  `sourceMovementId` VARCHAR(191) NOT NULL,
  `receiptDate` DATE NOT NULL,
  `postingDate` DATE NOT NULL,
  `originalQuantity` DECIMAL(18, 4) NOT NULL,
  `remainingQuantity` DECIMAL(18, 4) NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL,
  `originalValue` DECIMAL(18, 2) NOT NULL,
  `remainingValue` DECIMAL(18, 2) NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `status` ENUM('OPEN', 'CONSUMED', 'REVERSED', 'ADJUSTED') NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `inv_cost_layer_tenant_src_movement_uidx` (`tenantId`, `sourceMovementId`),
  INDEX `inv_cost_layer_tenant_item_wh_status_idx` (`tenantId`, `itemId`, `warehouseId`, `status`),
  INDEX `inv_cost_layer_tenant_receipt_idx` (`tenantId`, `receiptDate`),

  CONSTRAINT `inv_cost_layer_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_le_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_item_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_wh_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_movement_fkey` FOREIGN KEY (`sourceMovementId`) REFERENCES `inventory_stock_movements` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_lot_fkey` FOREIGN KEY (`lotId`) REFERENCES `inventory_lots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_layer_serial_fkey` FOREIGN KEY (`serialId`) REFERENCES `inventory_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_cost_layer_consumptions` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `issueCostEntryId` VARCHAR(191) NOT NULL,
  `layerId` VARCHAR(191) NOT NULL,
  `quantityConsumed` DECIMAL(18, 4) NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL,
  `totalCost` DECIMAL(18, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `inv_cost_lc_tenant_layer_idx` (`tenantId`, `layerId`),
  INDEX `inv_cost_lc_tenant_issue_idx` (`tenantId`, `issueCostEntryId`),

  CONSTRAINT `inv_cost_lc_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_lc_issue_entry_fkey` FOREIGN KEY (`issueCostEntryId`) REFERENCES `inventory_cost_entries` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_lc_layer_fkey` FOREIGN KEY (`layerId`) REFERENCES `inventory_cost_layers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

