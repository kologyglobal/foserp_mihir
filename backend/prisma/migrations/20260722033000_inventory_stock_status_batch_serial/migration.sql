-- Inventory stock-status buckets and inventory-owned batch/serial traceability.
-- Forward-only: existing stock is treated as UNRESTRICTED.

-- Idempotent column adds (safe when emergency repair already applied)
SET @db := DATABASE();
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='batchTracked'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `batchTracked` BOOLEAN NOT NULL DEFAULT false'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='serialTracked'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `serialTracked` BOOLEAN NOT NULL DEFAULT false'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_balances' AND COLUMN_NAME='qcHoldQty'), 'SELECT 1', 'ALTER TABLE `inventory_stock_balances` ADD COLUMN `qcHoldQty` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_balances' AND COLUMN_NAME='blockedQty'), 'SELECT 1', 'ALTER TABLE `inventory_stock_balances` ADD COLUMN `blockedQty` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_balances' AND COLUMN_NAME='rejectedQty'), 'SELECT 1', 'ALTER TABLE `inventory_stock_balances` ADD COLUMN `rejectedQty` DECIMAL(18,4) NOT NULL DEFAULT 0'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `inventory_stock_movements`
  ADD COLUMN `stockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NOT NULL DEFAULT 'UNRESTRICTED',
  ADD COLUMN `fromStockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NULL,
  ADD COLUMN `batchId` VARCHAR(191) NULL,
  ADD COLUMN `serialId` VARCHAR(191) NULL,
  ADD COLUMN `batchNumberSnapshot` VARCHAR(64) NULL,
  ADD COLUMN `serialNumberSnapshot` VARCHAR(100) NULL,
  ADD INDEX `inventory_stock_movements_tenantId_stockStatus_idx` (`tenantId`, `stockStatus`),
  ADD INDEX `inventory_stock_movements_tenantId_batchId_idx` (`tenantId`, `batchId`),
  ADD INDEX `inventory_stock_movements_tenantId_serialId_idx` (`tenantId`, `serialId`);

CREATE TABLE `inventory_batches` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `batchNumber` VARCHAR(64) NOT NULL,
  `lotNumber` VARCHAR(64) NULL,
  `heatNumber` VARCHAR(64) NULL,
  `manufacturingDate` DATE NULL,
  `expiryDate` DATE NULL,
  `supplierBatchNumber` VARCHAR(64) NULL,
  `status` ENUM('ACTIVE','BLOCKED','EXPIRED','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_batches_tenantId_itemId_batchNumber_key` (`tenantId`, `itemId`, `batchNumber`),
  INDEX `inventory_batches_tenantId_status_idx` (`tenantId`, `status`),
  INDEX `inventory_batches_tenantId_expiryDate_idx` (`tenantId`, `expiryDate`),
  CONSTRAINT `inventory_batches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_batches_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_batch_balances` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `stockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NOT NULL DEFAULT 'UNRESTRICTED',
  `quantity` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_batch_balances_tenant_batch_wh_status_key` (`tenantId`, `batchId`, `warehouseId`, `stockStatus`),
  INDEX `inventory_batch_balances_tenantId_itemId_warehouseId_idx` (`tenantId`, `itemId`, `warehouseId`),
  CONSTRAINT `inventory_batch_balances_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_batch_balances_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_batch_balances_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_batch_balances_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_serials` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `batchId` VARCHAR(191) NULL,
  `warehouseId` VARCHAR(191) NULL,
  `stockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NOT NULL DEFAULT 'UNRESTRICTED',
  `status` ENUM('AVAILABLE','QC_HOLD','BLOCKED','REJECTED','ISSUED') NOT NULL DEFAULT 'AVAILABLE',
  `sourceReferenceType` ENUM('OPN','INW','ISS','ADJ','GRN','ISSUE_TO_WO','RETURN_FROM_WO','WIP_RECEIVE','WIP_TRANSFER','MOVE_TO_WIP','MOVE_FROM_WIP','SA_RECEIPT','FG_RECEIPT','DISPATCH','FG_DISPATCH','SUBCON_OUT','SUBCON_IN','QUALITY_RELEASE','QUALITY_HOLD','QUALITY_REJECT','TRANSFER_DISPATCH','TRANSFER_RECEIPT','TRANSFER_REVERSAL','STOCK_COUNT','STOCK_COUNT_REVERSAL','CONTROLLED_ADJUSTMENT','ADJUSTMENT_REVERSAL') NULL,
  `sourceReferenceNo` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_serials_tenantId_itemId_serialNumber_key` (`tenantId`, `itemId`, `serialNumber`),
  INDEX `inventory_serials_tenantId_serialNumber_idx` (`tenantId`, `serialNumber`),
  INDEX `inventory_serials_tenantId_itemId_warehouseId_stockStatus_idx` (`tenantId`, `itemId`, `warehouseId`, `stockStatus`),
  CONSTRAINT `inventory_serials_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_serials_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_serials_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_serials_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_serial_movements` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `serialId` VARCHAR(191) NOT NULL,
  `movementId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `fromStockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NULL,
  `stockStatus` ENUM('UNRESTRICTED','QC_HOLD','BLOCKED','REJECTED') NOT NULL,
  `quantity` DECIMAL(18,4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_serial_movements_tenantId_serialId_movementId_key` (`tenantId`, `serialId`, `movementId`),
  INDEX `inventory_serial_movements_tenantId_movementId_idx` (`tenantId`, `movementId`),
  INDEX `inventory_serial_movements_tenantId_serialId_createdAt_idx` (`tenantId`, `serialId`, `createdAt`),
  CONSTRAINT `inventory_serial_movements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_serial_movements_serialId_fkey` FOREIGN KEY (`serialId`) REFERENCES `inventory_serials` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_serial_movements_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `inventory_stock_movements` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_serial_movements_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_stock_movements`
  ADD CONSTRAINT `inventory_stock_movements_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_movements_serialId_fkey` FOREIGN KEY (`serialId`) REFERENCES `inventory_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_transfer_lines`
  ADD COLUMN `batchId` VARCHAR(191) NULL,
  ADD COLUMN `serialId` VARCHAR(191) NULL,
  ADD COLUMN `batchNumberSnapshot` VARCHAR(64) NULL,
  ADD COLUMN `serialNumberSnapshot` VARCHAR(100) NULL,
  ADD INDEX `inventory_transfer_lines_tenantId_batchId_idx` (`tenantId`, `batchId`),
  ADD INDEX `inventory_transfer_lines_tenantId_serialId_idx` (`tenantId`, `serialId`),
  ADD CONSTRAINT `inventory_transfer_lines_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_transfer_lines_serialId_fkey` FOREIGN KEY (`serialId`) REFERENCES `inventory_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
