-- Wave 4: first-class lot masters and serial-master extensions.
CREATE TABLE `inventory_lots` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NULL,
  `lotNumber` VARCHAR(100) NOT NULL,
  `heatNumber` VARCHAR(100) NULL,
  `quantityOnHand` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE','QUARANTINE','EXPIRED','CONSUMED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `manufacturedAt` DATE NULL,
  `expiryDate` DATE NULL,
  `receivedAt` DATETIME(3) NULL,
  `sourceReferenceType` VARCHAR(64) NULL,
  `sourceReferenceId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `inventory_lots_tenantId_itemId_lotNumber_key`(`tenantId`, `itemId`, `lotNumber`),
  INDEX `inventory_lots_tenantId_warehouseId_status_idx`(`tenantId`, `warehouseId`, `status`),
  INDEX `inventory_lots_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_lots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_lots_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_lots_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_serials`
  MODIFY `status` ENUM('AVAILABLE','RESERVED','QC_HOLD','BLOCKED','REJECTED','ISSUED','SCRAPPED','RETURNED') NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN `lotId` VARCHAR(191) NULL,
  ADD COLUMN `createdBy` VARCHAR(191) NULL,
  ADD COLUMN `updatedBy` VARCHAR(191) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD INDEX `inventory_serials_tenantId_lotId_idx`(`tenantId`, `lotId`),
  ADD INDEX `inventory_serials_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  ADD CONSTRAINT `inventory_serials_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `inventory_lots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `inventory_lot_movements` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `lotId` VARCHAR(191) NOT NULL,
  `stockMovementId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18,4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_lot_movements_stockMovementId_lotId_key`(`stockMovementId`, `lotId`),
  INDEX `inventory_lot_movements_tenantId_lotId_idx`(`tenantId`, `lotId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_lot_movements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_lot_movements_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `inventory_lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_lot_movements_stockMovementId_fkey` FOREIGN KEY (`stockMovementId`) REFERENCES `inventory_stock_movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `inventoryLotId` VARCHAR(191) NULL,
  ADD INDEX `goods_receipt_lines_tenantId_inventoryLotId_idx`(`tenantId`, `inventoryLotId`),
  ADD CONSTRAINT `goods_receipt_lines_inventoryLotId_fkey` FOREIGN KEY (`inventoryLotId`) REFERENCES `inventory_lots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `production_finished_goods_receipts`
  ADD COLUMN `inventoryLotId` VARCHAR(191) NULL,
  ADD INDEX `prod_fg_rcp_tenant_lot_idx`(`tenantId`, `inventoryLotId`),
  ADD CONSTRAINT `production_finished_goods_receipts_inventoryLotId_fkey` FOREIGN KEY (`inventoryLotId`) REFERENCES `inventory_lots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dispatch_tracking_allocations`
  ADD COLUMN `inventoryLotId` VARCHAR(191) NULL,
  ADD COLUMN `inventorySerialId` VARCHAR(191) NULL,
  ADD INDEX `dispatch_track_alloc_lot_idx`(`tenantId`, `inventoryLotId`),
  ADD INDEX `dispatch_track_alloc_serial_idx`(`tenantId`, `inventorySerialId`),
  ADD CONSTRAINT `dispatch_tracking_allocations_inventoryLotId_fkey` FOREIGN KEY (`inventoryLotId`) REFERENCES `inventory_lots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `dispatch_tracking_allocations_inventorySerialId_fkey` FOREIGN KEY (`inventorySerialId`) REFERENCES `inventory_serials`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
