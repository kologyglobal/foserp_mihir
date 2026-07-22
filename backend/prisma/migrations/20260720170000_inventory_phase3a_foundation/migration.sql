-- Inventory Phase 3A — Stock ledger foundation
-- Additive only. Physical stock SoT; no bin/heat/batch-serial/MRP/GL.

ALTER TABLE `code_series` MODIFY `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION'
) NOT NULL;

CREATE TABLE `inventory_stock_balances` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `onHandQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reservedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_stock_balances_tenantId_itemId_warehouseId_key`(`tenantId`, `itemId`, `warehouseId`),
    INDEX `inventory_stock_balances_tenantId_idx`(`tenantId`),
    INDEX `inventory_stock_balances_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_stock_reservations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `reservationNumber` VARCHAR(64) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `fulfilledQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `demandType` ENUM('SO', 'WO') NOT NULL,
    `demandId` VARCHAR(191) NOT NULL,
    `referenceNo` VARCHAR(100) NULL,
    `status` ENUM('ACTIVE', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `remarks` TEXT NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `fulfilledAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_stock_reservations_tenantId_reservationNumber_key`(`tenantId`, `reservationNumber`),
    UNIQUE INDEX `inventory_stock_reservations_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    INDEX `inventory_stock_reservations_tenantId_idx`(`tenantId`),
    INDEX `inv_stock_res_tenant_item_wh_st_idx`(`tenantId`, `itemId`, `warehouseId`, `status`),
    INDEX `inv_stock_res_tenant_demand_idx`(`tenantId`, `demandType`, `demandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `movementNumber` VARCHAR(64) NOT NULL,
    `movementDate` DATE NOT NULL,
    `movementType` ENUM('OPENING', 'INWARD', 'ISSUE', 'ADJUSTMENT') NOT NULL,
    `referenceType` ENUM(
      'OPN', 'INW', 'ISS', 'ADJ', 'GRN', 'ISSUE_TO_WO', 'RETURN_FROM_WO',
      'WIP_RECEIVE', 'WIP_TRANSFER', 'MOVE_TO_WIP', 'MOVE_FROM_WIP',
      'SA_RECEIPT', 'FG_RECEIPT', 'DISPATCH', 'FG_DISPATCH', 'SUBCON_OUT', 'SUBCON_IN'
    ) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `value` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `balanceAfter` DECIMAL(18, 4) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NULL,
    `sourceWorkOrderId` VARCHAR(191) NULL,
    `parentWorkOrderId` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `referenceNo` VARCHAR(100) NULL,
    `remarks` TEXT NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_stock_movements_tenantId_movementNumber_key`(`tenantId`, `movementNumber`),
    UNIQUE INDEX `inventory_stock_movements_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    INDEX `inventory_stock_movements_tenantId_idx`(`tenantId`),
    INDEX `inventory_stock_movements_tenantId_itemId_warehouseId_idx`(`tenantId`, `itemId`, `warehouseId`),
    INDEX `inventory_stock_movements_tenantId_workOrderId_idx`(`tenantId`, `workOrderId`),
    INDEX `inventory_stock_movements_tenantId_movementDate_idx`(`tenantId`, `movementDate`),
    INDEX `inventory_stock_movements_tenantId_referenceType_idx`(`tenantId`, `referenceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_stock_balances`
  ADD CONSTRAINT `inventory_stock_balances_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_balances_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_balances_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_stock_reservations`
  ADD CONSTRAINT `inventory_stock_reservations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_reservations_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_reservations_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_stock_movements`
  ADD CONSTRAINT `inventory_stock_movements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_movements_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_movements_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_stock_movements_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `inventory_stock_reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
