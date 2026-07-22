-- Quality Phase 4A — Inspection + NCR foundation (no Job Work / subcontracting)

ALTER TABLE `code_series` MODIFY `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR'
) NOT NULL;

ALTER TABLE `production_orders`
  MODIFY `qualityStatus` ENUM(
    'NOT_APPLICABLE', 'PENDING_INTEGRATION', 'PENDING_QC', 'IN_QC', 'PASSED', 'FAILED', 'HOLD'
  ) NOT NULL DEFAULT 'PENDING_INTEGRATION';

ALTER TABLE `production_activities` MODIFY `activityType` ENUM(
  'CREATED', 'DEMAND_CREATED', 'DEMAND_CONVERTED', 'RELEASED', 'STARTED', 'HELD', 'RESUMED',
  'STAGE_READY', 'STAGE_STARTED', 'PROGRESS_RECORDED', 'STAGE_COMPLETED', 'COMPLETED', 'CANCELLED',
  'CORRECTION', 'ASSIGNED', 'DUE_DATE_CHANGED', 'PRIORITY_CHANGED',
  'OPERATOR_ASSIGNED', 'MACHINE_ASSIGNED', 'WORK_REASSIGNED', 'ASSIGNMENT_CANCELLED', 'ASSIGNMENT_ACCEPTED',
  'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_COMPLETED',
  'DAILY_PRODUCTION_SUBMITTED', 'DAILY_PRODUCTION_CORRECTED',
  'ISSUE_REPORTED', 'ISSUE_ACKNOWLEDGED', 'ISSUE_RESOLVED', 'ISSUE_CANCELLED',
  'DOWNTIME_STARTED', 'DOWNTIME_ENDED',
  'QC_REQUESTED', 'QC_PASSED', 'QC_REWORK', 'QC_REJECTED', 'NCR_OPENED', 'NCR_CLOSED'
) NOT NULL;

CREATE TABLE `quality_inspections` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inspectionNumber` VARCHAR(64) NOT NULL,
    `category` ENUM('INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN') NOT NULL,
    `status` ENUM('PENDING', 'PASSED', 'REWORK', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `decision` ENUM('PASS', 'REWORK', 'REJECT') NULL,
    `productionOrderId` VARCHAR(191) NULL,
    `stageId` VARCHAR(191) NULL,
    `operationId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `inspectedQty` DECIMAL(18, 4) NULL,
    `acceptedQty` DECIMAL(18, 4) NULL,
    `rejectedQty` DECIMAL(18, 4) NULL,
    `reworkQty` DECIMAL(18, 4) NULL,
    `title` VARCHAR(200) NOT NULL,
    `remarks` TEXT NULL,
    `decisionRemarks` TEXT NULL,
    `requestedByUserId` VARCHAR(191) NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quality_inspections_tenantId_inspectionNumber_key`(`tenantId`, `inspectionNumber`),
    UNIQUE INDEX `quality_inspections_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    INDEX `quality_inspections_tenantId_idx`(`tenantId`),
    INDEX `quality_inspections_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `quality_inspections_tenantId_category_idx`(`tenantId`, `category`),
    INDEX `quality_inspections_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quality_ncrs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ncrNumber` VARCHAR(64) NOT NULL,
    `status` ENUM('OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `severity` ENUM('MINOR', 'MAJOR', 'CRITICAL') NOT NULL DEFAULT 'MAJOR',
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `productionOrderId` VARCHAR(191) NULL,
    `inspectionId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `reportedByUserId` VARCHAR(191) NULL,
    `closedByUserId` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `closureNotes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quality_ncrs_tenantId_ncrNumber_key`(`tenantId`, `ncrNumber`),
    INDEX `quality_ncrs_tenantId_idx`(`tenantId`),
    INDEX `quality_ncrs_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `quality_ncrs_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quality_inspections`
  ADD CONSTRAINT `quality_inspections_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_inspections_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_inspections_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_inspections_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_inspections_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quality_ncrs`
  ADD CONSTRAINT `quality_ncrs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_ncrs_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_ncrs_inspectionId_fkey` FOREIGN KEY (`inspectionId`) REFERENCES `quality_inspections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `quality_ncrs_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
