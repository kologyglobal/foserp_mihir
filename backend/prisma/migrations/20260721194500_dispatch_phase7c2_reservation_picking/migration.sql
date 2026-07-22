-- Dispatch Phase 7C2 — FG reservation + allocation-only picking.
-- Additive only. Reservation updates reservedQty; pick/unpick does not post stock movements.

-- Code series enum: add DISPATCH_PICK_LIST
ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT', 'MANUFACTURING_CORRECTION', 'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN', 'OUTBOUND_DISPATCH', 'PRODUCTION_FG_RECEIPT',
  'DISPATCH_REQUIREMENT', 'DISPATCH_PICK_LIST'
) NOT NULL;

-- Extend inventory reservations for dispatch linkage
ALTER TABLE `inventory_stock_reservations`
  ADD COLUMN `releasedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `outboundDispatchId` VARCHAR(191) NULL,
  ADD COLUMN `outboundDispatchLineId` VARCHAR(191) NULL,
  ADD COLUMN `dispatchRequirementId` VARCHAR(191) NULL,
  ADD COLUMN `salesOrderId` VARCHAR(191) NULL,
  ADD COLUMN `salesOrderLineId` VARCHAR(64) NULL,
  ADD COLUMN `sourceVersion` INTEGER NOT NULL DEFAULT 1;

CREATE INDEX `inv_stock_res_tenant_ob_dispatch_idx` ON `inventory_stock_reservations`(`tenantId`, `outboundDispatchId`);
CREATE INDEX `inv_stock_res_tenant_ob_line_idx` ON `inventory_stock_reservations`(`tenantId`, `outboundDispatchLineId`);

ALTER TABLE `inventory_stock_reservations`
  ADD CONSTRAINT `inventory_stock_reservations_outboundDispatchId_fkey`
  FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_stock_reservations`
  ADD CONSTRAINT `inventory_stock_reservations_outboundDispatchLineId_fkey`
  FOREIGN KEY (`outboundDispatchLineId`) REFERENCES `outbound_dispatch_lines`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_stock_reservations`
  ADD CONSTRAINT `inventory_stock_reservations_dispatchRequirementId_fkey`
  FOREIGN KEY (`dispatchRequirementId`) REFERENCES `dispatch_requirements`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `dispatch_tracking_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `inventoryReservationId` VARCHAR(191) NOT NULL,
  `outboundDispatchId` VARCHAR(191) NOT NULL,
  `outboundDispatchLineId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `lotRef` VARCHAR(100) NULL,
  `serialRef` VARCHAR(100) NULL,
  `heatNumber` VARCHAR(100) NULL,
  `allocatedQuantity` DECIMAL(18, 4) NOT NULL,
  `status` ENUM('ALLOCATED', 'PICKED', 'RELEASED', 'CONSUMED', 'CANCELLED') NOT NULL DEFAULT 'ALLOCATED',
  `serialActiveKey` VARCHAR(100) AS (
    CASE
      WHEN `serialRef` IS NOT NULL AND `status` IN ('ALLOCATED', 'PICKED') THEN `serialRef`
      ELSE NULL
    END
  ) STORED,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_track_alloc_serial_active_uidx`(`tenantId`, `serialActiveKey`),
  INDEX `dispatch_track_alloc_ob_dispatch_idx`(`tenantId`, `outboundDispatchId`),
  INDEX `dispatch_track_alloc_ob_line_idx`(`tenantId`, `outboundDispatchLineId`),
  INDEX `dispatch_track_alloc_res_idx`(`tenantId`, `inventoryReservationId`),
  CONSTRAINT `dispatch_tracking_allocations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_tracking_allocations_inventoryReservationId_fkey` FOREIGN KEY (`inventoryReservationId`) REFERENCES `inventory_stock_reservations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_tracking_allocations_outboundDispatchId_fkey` FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_tracking_allocations_outboundDispatchLineId_fkey` FOREIGN KEY (`outboundDispatchLineId`) REFERENCES `outbound_dispatch_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_tracking_allocations_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_tracking_allocations_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispatch_pick_lists` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `pickListNumber` VARCHAR(64) NOT NULL,
  `outboundDispatchId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `assignedTo` VARCHAR(191) NULL,
  `plannedPickDate` DATE NULL,
  `priority` VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PARTIALLY_PICKED', 'PICKED', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `releasedAt` DATETIME(3) NULL,
  `releasedBy` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NULL,
  `startedBy` VARCHAR(191) NULL,
  `completedAt` DATETIME(3) NULL,
  `completedBy` VARCHAR(191) NULL,
  `sourceVersion` INTEGER NOT NULL DEFAULT 1,
  `idempotencyKey` VARCHAR(150) NULL,
  `remarks` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_pick_list_tenant_number_uidx`(`tenantId`, `pickListNumber`),
  UNIQUE INDEX `dispatch_pick_list_tenant_idem_uidx`(`tenantId`, `idempotencyKey`),
  INDEX `dispatch_pick_list_tenant_ob_idx`(`tenantId`, `outboundDispatchId`),
  INDEX `dispatch_pick_list_tenant_status_idx`(`tenantId`, `status`),
  INDEX `dispatch_pick_list_tenant_del_idx`(`tenantId`, `deletedAt`),
  CONSTRAINT `dispatch_pick_lists_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lists_outboundDispatchId_fkey` FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lists_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispatch_pick_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `pickListId` VARCHAR(191) NOT NULL,
  `outboundDispatchLineId` VARCHAR(191) NOT NULL,
  `dispatchRequirementId` VARCHAR(191) NULL,
  `salesOrderId` VARCHAR(191) NULL,
  `salesOrderLineId` VARCHAR(64) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `requestedQuantity` DECIMAL(18, 4) NOT NULL,
  `reservedQuantity` DECIMAL(18, 4) NOT NULL,
  `pickedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `shortageQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'PARTIALLY_PICKED', 'PICKED', 'SHORT', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
  `primaryShortageReason` VARCHAR(500) NULL,
  `sourceVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `dispatch_pick_line_tenant_list_idx`(`tenantId`, `pickListId`),
  INDEX `dispatch_pick_line_tenant_ob_line_idx`(`tenantId`, `outboundDispatchLineId`),
  CONSTRAINT `dispatch_pick_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lines_pickListId_fkey` FOREIGN KEY (`pickListId`) REFERENCES `dispatch_pick_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lines_outboundDispatchLineId_fkey` FOREIGN KEY (`outboundDispatchLineId`) REFERENCES `outbound_dispatch_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_lines_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispatch_pick_events` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `pickListId` VARCHAR(191) NOT NULL,
  `pickLineId` VARCHAR(191) NOT NULL,
  `eventType` ENUM('PICK', 'UNPICK', 'SHORTAGE', 'SHORTAGE_RESOLVED', 'ASSIGNMENT_CHANGE', 'RELEASE', 'START', 'COMPLETE', 'CANCEL') NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `lotRef` VARCHAR(100) NULL,
  `serialRef` VARCHAR(100) NULL,
  `heatNumber` VARCHAR(100) NULL,
  `reasonCode` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `sourceVersion` INTEGER NOT NULL DEFAULT 1,
  `idempotencyKey` VARCHAR(150) NULL,
  `performedBy` VARCHAR(191) NOT NULL,
  `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reversalOfEventId` VARCHAR(191) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_pick_event_tenant_idem_uidx`(`tenantId`, `idempotencyKey`),
  INDEX `dispatch_pick_event_tenant_list_idx`(`tenantId`, `pickListId`),
  INDEX `dispatch_pick_event_tenant_line_idx`(`tenantId`, `pickLineId`),
  CONSTRAINT `dispatch_pick_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_events_pickListId_fkey` FOREIGN KEY (`pickListId`) REFERENCES `dispatch_pick_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dispatch_pick_events_pickLineId_fkey` FOREIGN KEY (`pickLineId`) REFERENCES `dispatch_pick_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
