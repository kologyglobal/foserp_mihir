-- Dispatch Phase 7C1 — DispatchRequirement + draft planning fields on OutboundDispatch.
-- Additive only. Does not rewrite 7C0 fulfilment or FG_DISPATCH posting semantics.

-- Code series enum: add DISPATCH_REQUIREMENT
ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT', 'MANUFACTURING_CORRECTION', 'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN', 'OUTBOUND_DISPATCH', 'PRODUCTION_FG_RECEIPT',
  'DISPATCH_REQUIREMENT'
) NOT NULL;

-- Planning source for OutboundDispatch (7C0 rows default BASIC_7C0)
ALTER TABLE `outbound_dispatches`
  ADD COLUMN `customerId` VARCHAR(191) NULL,
  ADD COLUMN `shipToKey` VARCHAR(200) NULL,
  ADD COLUMN `shipToAddress` TEXT NULL,
  ADD COLUMN `plannedDispatchDate` DATE NULL,
  ADD COLUMN `preferredWarehouseId` VARCHAR(191) NULL,
  ADD COLUMN `planningSource` ENUM('BASIC_7C0', 'WORKBENCH_7C1') NOT NULL DEFAULT 'BASIC_7C0',
  ADD COLUMN `planBeforeStockAllowed` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `outbound_dispatches_tenantId_customerId_idx` ON `outbound_dispatches`(`tenantId`, `customerId`);
CREATE INDEX `outbound_dispatches_tenantId_plannedDispatchDate_idx` ON `outbound_dispatches`(`tenantId`, `plannedDispatchDate`);

ALTER TABLE `outbound_dispatch_lines`
  ADD COLUMN `dispatchRequirementId` VARCHAR(191) NULL,
  ADD COLUMN `readyQuantitySnapshot` DECIMAL(18, 4) NULL;

CREATE INDEX `ob_dispatch_line_req_idx` ON `outbound_dispatch_lines`(`tenantId`, `dispatchRequirementId`);

CREATE TABLE `dispatch_requirements` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `requirementNumber` VARCHAR(64) NOT NULL,
  `salesOrderId` VARCHAR(191) NOT NULL,
  `salesOrderLineId` VARCHAR(64) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `shipToKey` VARCHAR(200) NULL,
  `shipToAddress` TEXT NULL,
  `itemId` VARCHAR(191) NULL,
  `productId` VARCHAR(191) NULL,
  `uomCode` VARCHAR(32) NULL,
  `plantCode` VARCHAR(32) NULL,
  `preferredWarehouseId` VARCHAR(191) NULL,
  `orderedQuantitySnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cancelledQuantitySnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netOrderedQuantitySnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netDispatchedQuantitySnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `remainingQuantitySnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currentDraftDispatchQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `requestedDeliveryDate` DATE NULL,
  `committedDeliveryDate` DATE NULL,
  `priority` VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  `commercialHold` BOOLEAN NOT NULL DEFAULT false,
  `dispatchHold` BOOLEAN NOT NULL DEFAULT false,
  `holdReason` VARCHAR(500) NULL,
  `readinessStatus` ENUM(
    'NOT_READY',
    'WAITING_FOR_PRODUCTION',
    'WAITING_FOR_QUALITY',
    'WAITING_FOR_STOCK',
    'PARTIALLY_READY',
    'READY_TO_DISPATCH',
    'ALREADY_IN_DRAFT_DISPATCH',
    'ON_HOLD',
    'BLOCKED',
    'FULLY_FULFILLED',
    'CANCELLED',
    'RECONCILIATION_REQUIRED'
  ) NOT NULL DEFAULT 'NOT_READY',
  `primaryBlockerCode` VARCHAR(64) NULL,
  `status` ENUM('ACTIVE', 'ON_HOLD', 'FULFILLED', 'CANCELLED', 'RECONCILIATION_REQUIRED') NOT NULL DEFAULT 'ACTIVE',
  `sourceVersion` INTEGER NOT NULL DEFAULT 1,
  `sourceFingerprint` VARCHAR(128) NULL,
  `lastCalculatedAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_req_tenant_so_line_uidx`(`tenantId`, `salesOrderId`, `salesOrderLineId`),
  UNIQUE INDEX `dispatch_req_tenant_number_uidx`(`tenantId`, `requirementNumber`),
  INDEX `dispatch_req_tenant_status_idx`(`tenantId`, `status`),
  INDEX `dispatch_req_tenant_ready_idx`(`tenantId`, `readinessStatus`),
  INDEX `dispatch_req_tenant_due_idx`(`tenantId`, `requestedDeliveryDate`),
  INDEX `dispatch_req_tenant_customer_idx`(`tenantId`, `customerId`),
  INDEX `dispatch_req_tenant_item_idx`(`tenantId`, `itemId`),
  INDEX `dispatch_req_tenant_so_idx`(`tenantId`, `salesOrderId`),
  INDEX `dispatch_req_tenant_del_idx`(`tenantId`, `deletedAt`),
  CONSTRAINT `dispatch_requirements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_requirements_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `crm_sales_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `outbound_dispatch_lines`
  ADD CONSTRAINT `outbound_dispatch_lines_dispatchRequirementId_fkey`
  FOREIGN KEY (`dispatchRequirementId`) REFERENCES `dispatch_requirements`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
