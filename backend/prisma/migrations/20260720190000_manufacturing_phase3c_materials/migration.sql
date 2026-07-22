-- Manufacturing Phase 3C — Production Order Materials (Inventory + Purchase integration)
-- Additive. Physical stock remains Inventory SoT; this table holds Production intent + links.

ALTER TABLE `production_orders`
  MODIFY `materialControlStatus` ENUM('NOT_CONNECTED', 'PENDING_INVENTORY', 'ACTIVE') NOT NULL DEFAULT 'NOT_CONNECTED';

CREATE TABLE `production_order_materials` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `bomLineId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `uomId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NULL,
    `requiredQty` DECIMAL(18, 4) NOT NULL,
    `reservedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `issuedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `returnedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `shortageQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'RESERVED', 'PARTIAL', 'ISSUED', 'SHORT', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `reservationId` VARCHAR(191) NULL,
    `purchaseRequisitionId` VARCHAR(191) NULL,
    `issueStageGroupId` VARCHAR(191) NULL,
    `issueOperationId` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pom_tenant_order_bomline_key`(`tenantId`, `productionOrderId`, `bomLineId`),
    INDEX `production_order_materials_tenantId_idx`(`tenantId`),
    INDEX `pom_tenant_order_idx`(`tenantId`, `productionOrderId`),
    INDEX `pom_tenant_status_idx`(`tenantId`, `status`),
    INDEX `pom_tenant_pr_idx`(`tenantId`, `purchaseRequisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `production_order_materials`
  ADD CONSTRAINT `production_order_materials_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_bomLineId_fkey` FOREIGN KEY (`bomLineId`) REFERENCES `production_order_bom_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `production_order_materials_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `inventory_stock_reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: the purchaseRequisitionId FK is added in 20260720260000_manufacturing_phase3c_pr_link_fk
-- because purchase_requisitions is created later (20260720250000_purchase_phase3b_requisition).
-- Keeping it here broke fresh-database replays (P3009 / MySQL error 1824).
