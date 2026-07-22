-- Dispatch Phase 7C0 — SO line fulfilment ledger + thin OutboundDispatch + FG_DISPATCH path
-- Additive. JSON SO line IDs remain interim. No pick/pack/challan/invoice/e-Way/POD.

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT', 'MANUFACTURING_CORRECTION', 'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN', 'OUTBOUND_DISPATCH', 'PRODUCTION_FG_RECEIPT'
) NOT NULL;

ALTER TABLE `inventory_stock_reservations`
  MODIFY COLUMN `demandType` ENUM('SO', 'WO', 'DISPATCH') NOT NULL;

CREATE TABLE `sales_order_line_fulfilments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NOT NULL,
    `salesOrderLineId` VARCHAR(64) NOT NULL,
    `cancelledQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `so_line_fulfil_tenant_so_line_uidx`(`tenantId`, `salesOrderId`, `salesOrderLineId`),
    INDEX `so_line_fulfil_tenant_so_idx`(`tenantId`, `salesOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `outbound_dispatches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `dispatchNo` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `salesOrderId` VARCHAR(191) NULL,
    `salesOrderNo` VARCHAR(64) NULL,
    `remarks` TEXT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `outbound_dispatches_tenantId_dispatchNo_key`(`tenantId`, `dispatchNo`),
    UNIQUE INDEX `outbound_dispatches_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    INDEX `outbound_dispatches_tenantId_idx`(`tenantId`),
    INDEX `outbound_dispatches_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `outbound_dispatches_tenantId_salesOrderId_idx`(`tenantId`, `salesOrderId`),
    INDEX `outbound_dispatches_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `outbound_dispatch_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `outboundDispatchId` VARCHAR(191) NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `salesOrderLineId` VARCHAR(64) NULL,
    `inventoryMovementId` VARCHAR(191) NULL,
    `inventoryMovementNo` VARCHAR(64) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `outbound_dispatch_lines_outboundDispatchId_lineNo_key`(`outboundDispatchId`, `lineNo`),
    INDEX `outbound_dispatch_lines_tenantId_idx`(`tenantId`),
    INDEX `ob_dispatch_line_so_line_idx`(`tenantId`, `salesOrderId`, `salesOrderLineId`),
    INDEX `outbound_dispatch_lines_tenantId_outboundDispatchId_idx`(`tenantId`, `outboundDispatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_order_line_fulfilments`
  ADD CONSTRAINT `sales_order_line_fulfilments_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_order_line_fulfilments_salesOrderId_fkey`
    FOREIGN KEY (`salesOrderId`) REFERENCES `crm_sales_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `outbound_dispatches`
  ADD CONSTRAINT `outbound_dispatches_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `outbound_dispatches_salesOrderId_fkey`
    FOREIGN KEY (`salesOrderId`) REFERENCES `crm_sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `outbound_dispatch_lines`
  ADD CONSTRAINT `outbound_dispatch_lines_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `outbound_dispatch_lines_outboundDispatchId_fkey`
    FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `outbound_dispatch_lines_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `outbound_dispatch_lines_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
