-- Inventory document workflows: warehouse transfers, stock counts, controlled adjustments.
-- Forward-only; physical stock remains in inventory_stock_movements / inventory_stock_balances.

ALTER TABLE `code_series`
  MODIFY `entityType` ENUM(
    'USER','LEAD','CONTACT','CRM_COMPANY','OPPORTUNITY','QUOTATION','SALES_ORDER',
    'PRODUCTION_DEMAND','PRODUCTION_ORDER','DAILY_PRODUCTION_BATCH','PRODUCTION_ISSUE',
    'STOCK_MOVEMENT','STOCK_RESERVATION','PURCHASE_REQUISITION','PURCHASE_PLANNING',
    'REQUEST_FOR_QUOTATION','VENDOR_QUOTATION','VENDOR_COMPARISON','PURCHASE_ORDER',
    'GOODS_RECEIPT','QUALITY_INSPECTION','PURCHASE_QUALITY_INSPECTION','QUALITY_NCR',
    'PURCHASE_INVOICE','PURCHASE_RETURN','JOB_WORK_ORDER','PRODUCTION_RUNTIME_CHANGE',
    'PRODUCTION_WIP_MOVEMENT','MANUFACTURING_CORRECTION','PRODUCTION_PLAN',
    'DEMAND_CONSOLIDATION_PLAN','OUTBOUND_DISPATCH','PRODUCTION_FG_RECEIPT',
    'DISPATCH_REQUIREMENT','DISPATCH_PICK_LIST','DISPATCH_PACKING_SESSION',
    'DISPATCH_PACKAGE','DELIVERY_CHALLAN','INVENTORY_TRANSFER',
    'INVENTORY_STOCK_COUNT','INVENTORY_ADJUSTMENT'
  ) NOT NULL;

ALTER TABLE `inventory_stock_movements`
  MODIFY `referenceType` ENUM(
    'OPN','INW','ISS','ADJ','GRN','ISSUE_TO_WO','RETURN_FROM_WO','WIP_RECEIVE',
    'WIP_TRANSFER','MOVE_TO_WIP','MOVE_FROM_WIP','SA_RECEIPT','FG_RECEIPT',
    'DISPATCH','FG_DISPATCH','SUBCON_OUT','SUBCON_IN','QUALITY_RELEASE',
    'QUALITY_HOLD','QUALITY_REJECT','TRANSFER_DISPATCH','TRANSFER_RECEIPT',
    'TRANSFER_REVERSAL','STOCK_COUNT','STOCK_COUNT_REVERSAL',
    'CONTROLLED_ADJUSTMENT','ADJUSTMENT_REVERSAL'
  ) NOT NULL;

CREATE TABLE `inventory_transfers` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `transferNumber` VARCHAR(64) NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','IN_TRANSIT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','REVERSED') NOT NULL DEFAULT 'DRAFT',
  `fromWarehouseId` VARCHAR(191) NOT NULL,
  `toWarehouseId` VARCHAR(191) NOT NULL,
  `transferDate` DATE NOT NULL,
  `remarks` TEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `dispatchedAt` DATETIME(3) NULL,
  `dispatchedBy` VARCHAR(191) NULL,
  `receivedAt` DATETIME(3) NULL,
  `receivedBy` VARCHAR(191) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `reversalReason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_transfers_tenantId_transferNumber_key`(`tenantId`, `transferNumber`),
  INDEX `inventory_transfers_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `inventory_transfers_tenantId_fromWarehouseId_idx`(`tenantId`, `fromWarehouseId`),
  INDEX `inventory_transfers_tenantId_toWarehouseId_idx`(`tenantId`, `toWarehouseId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_transfer_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `transferId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18,4) NOT NULL,
  `dispatchedQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `receivedQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `rate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_transfer_lines_transferId_itemId_key`(`transferId`, `itemId`),
  INDEX `inventory_transfer_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_stock_counts` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `countNumber` VARCHAR(64) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','SNAPSHOTTED','COUNTING','SUBMITTED','APPROVED','POSTED','REVERSED') NOT NULL DEFAULT 'DRAFT',
  `countDate` DATE NOT NULL,
  `remarks` TEXT NULL,
  `snapshotAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `reversalReason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_stock_counts_tenantId_countNumber_key`(`tenantId`, `countNumber`),
  INDEX `inventory_stock_counts_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `inventory_stock_counts_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_stock_count_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `stockCountId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `systemQty` DECIMAL(18,4) NOT NULL,
  `countedQty` DECIMAL(18,4) NULL,
  `varianceQty` DECIMAL(18,4) NULL,
  `rate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_stock_count_lines_stockCountId_itemId_key`(`stockCountId`, `itemId`),
  INDEX `inventory_stock_count_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_adjustments` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `adjustmentNumber` VARCHAR(64) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','POSTED','REVERSED') NOT NULL DEFAULT 'DRAFT',
  `adjustmentDate` DATE NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `remarks` TEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `reversalReason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_adjustments_tenantId_adjustmentNumber_key`(`tenantId`, `adjustmentNumber`),
  INDEX `inventory_adjustments_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `inventory_adjustments_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_adjustment_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `adjustmentId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18,4) NOT NULL,
  `rate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `reason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_adjustment_lines_adjustmentId_itemId_key`(`adjustmentId`, `itemId`),
  INDEX `inventory_adjustment_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_transfers`
  ADD CONSTRAINT `inventory_transfers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_transfers_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_transfers_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_transfer_lines`
  ADD CONSTRAINT `inventory_transfer_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_transfer_lines_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `inventory_transfers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_transfer_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_stock_counts`
  ADD CONSTRAINT `inventory_stock_counts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_counts_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_stock_count_lines`
  ADD CONSTRAINT `inventory_stock_count_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_count_lines_stockCountId_fkey` FOREIGN KEY (`stockCountId`) REFERENCES `inventory_stock_counts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_count_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_adjustments`
  ADD CONSTRAINT `inventory_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_adjustments_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_adjustment_lines`
  ADD CONSTRAINT `inventory_adjustment_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_adjustment_lines_adjustmentId_fkey` FOREIGN KEY (`adjustmentId`) REFERENCES `inventory_adjustments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_adjustment_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
