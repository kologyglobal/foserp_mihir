-- Manufacturing Phase 2B — Daily Production, Assignments, Issues, Downtime
-- Additive only. Soft shiftCode/shiftLabel until HR Shift master exists.
-- Operator identity uses User (userId); employeeId is a soft future reference.

-- AlterTable: code series entities
ALTER TABLE `code_series` MODIFY `entityType` ENUM('USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER', 'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE') NOT NULL;

-- AlterTable: production activity types (Phase 2B events)
ALTER TABLE `production_activities` MODIFY `activityType` ENUM(
  'CREATED', 'DEMAND_CREATED', 'DEMAND_CONVERTED', 'RELEASED', 'STARTED', 'HELD', 'RESUMED',
  'STAGE_READY', 'STAGE_STARTED', 'PROGRESS_RECORDED', 'STAGE_COMPLETED', 'COMPLETED', 'CANCELLED',
  'CORRECTION', 'ASSIGNED', 'DUE_DATE_CHANGED', 'PRIORITY_CHANGED',
  'OPERATOR_ASSIGNED', 'MACHINE_ASSIGNED', 'WORK_REASSIGNED', 'ASSIGNMENT_CANCELLED', 'ASSIGNMENT_ACCEPTED',
  'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_COMPLETED',
  'DAILY_PRODUCTION_SUBMITTED', 'DAILY_PRODUCTION_CORRECTED',
  'ISSUE_REPORTED', 'ISSUE_ACKNOWLEDGED', 'ISSUE_RESOLVED', 'ISSUE_CANCELLED',
  'DOWNTIME_STARTED', 'DOWNTIME_ENDED'
) NOT NULL;

-- AlterTable: stage denormalised assignment / issue indicators
ALTER TABLE `production_order_stages`
  ADD COLUMN `assignedUserId` VARCHAR(191) NULL,
  ADD COLUMN `assignedMachineId` VARCHAR(191) NULL,
  ADD COLUMN `activeAssignmentCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `openIssueCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `pausedAt` DATETIME(3) NULL,
  ADD COLUMN `totalDowntimeMinutes` INTEGER NOT NULL DEFAULT 0;

-- AlterTable: operation denormalised assignment indicators
ALTER TABLE `production_order_operations`
  ADD COLUMN `assignedUserId` VARCHAR(191) NULL,
  ADD COLUMN `assignedMachineId` VARCHAR(191) NULL,
  ADD COLUMN `activeAssignmentId` VARCHAR(191) NULL,
  ADD COLUMN `pausedAt` DATETIME(3) NULL,
  ADD COLUMN `totalDowntimeMinutes` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `production_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `workCentreId` VARCHAR(191) NULL,
    `assignmentDate` DATE NOT NULL,
    `plannedStartAt` DATETIME(3) NULL,
    `plannedEndAt` DATETIME(3) NULL,
    `shiftCode` VARCHAR(32) NULL,
    `shiftLabel` VARCHAR(64) NULL,
    `assignedQuantity` DECIMAL(18, 4) NOT NULL,
    `completedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `assignedBy` VARCHAR(191) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,
    `notes` TEXT NULL,
    `workInstruction` TEXT NULL,
    `reassignedFromId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `production_assignments_tenantId_idx`(`tenantId`),
    INDEX `production_assignments_tenantId_userId_status_idx`(`tenantId`, `userId`, `status`),
    INDEX `production_assignments_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    INDEX `production_assignments_tenantId_stageId_status_idx`(`tenantId`, `stageId`, `status`),
    INDEX `production_assignments_tenantId_machineId_status_idx`(`tenantId`, `machineId`, `status`),
    INDEX `production_assignments_tenantId_assignmentDate_idx`(`tenantId`, `assignmentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_production_batches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(64) NOT NULL,
    `productionDate` DATE NOT NULL,
    `shiftCode` VARCHAR(32) NULL,
    `shiftLabel` VARCHAR(64) NULL,
    `plantCode` VARCHAR(32) NULL,
    `workCentreId` VARCHAR(191) NULL,
    `supervisorId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PARTIALLY_REVERSED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `totalLines` INTEGER NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NULL,
    `submittedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `daily_production_batches_tenantId_batchNumber_key`(`tenantId`, `batchNumber`),
    INDEX `daily_production_batches_tenantId_idx`(`tenantId`),
    INDEX `daily_production_batches_tenantId_productionDate_idx`(`tenantId`, `productionDate`),
    INDEX `daily_production_batches_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_production_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `workCentreId` VARCHAR(191) NULL,
    `goodQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `labourMinutes` INTEGER NULL,
    `machineMinutes` INTEGER NULL,
    `downtimeMinutes` INTEGER NULL,
    `remarks` TEXT NULL,
    `idempotencyKey` VARCHAR(150) NOT NULL,
    `resultingLedgerTransactionId` VARCHAR(191) NULL,
    `lineOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `daily_production_lines_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    INDEX `daily_production_lines_tenantId_idx`(`tenantId`),
    INDEX `daily_production_lines_batchId_idx`(`batchId`),
    INDEX `daily_production_lines_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_issues` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `issueNumber` VARCHAR(64) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NULL,
    `operationId` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `workCentreId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `reportedByUserId` VARCHAR(191) NOT NULL,
    `reportedByEmployeeId` VARCHAR(191) NULL,
    `issueType` ENUM('MATERIAL_SHORTAGE', 'MACHINE_BREAKDOWN', 'TOOL_UNAVAILABLE', 'POWER_FAILURE', 'QUALITY_HOLD', 'OPERATOR_UNAVAILABLE', 'DRAWING_ISSUE', 'SPECIFICATION_ISSUE', 'MAINTENANCE_REQUIRED', 'VENDOR_DELAY', 'SAFETY_CONCERN', 'OTHER') NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolution` TEXT NULL,
    `expectedImpactMinutes` INTEGER NULL,
    `actualDowntimeMinutes` INTEGER NULL,
    `productionBlocked` BOOLEAN NOT NULL DEFAULT false,
    `maintenanceReferenceId` VARCHAR(191) NULL,
    `qualityReferenceId` VARCHAR(191) NULL,
    `purchaseReferenceId` VARCHAR(191) NULL,
    `attachmentReference` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `production_issues_tenantId_issueNumber_key`(`tenantId`, `issueNumber`),
    INDEX `production_issues_tenantId_idx`(`tenantId`),
    INDEX `production_issues_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `production_issues_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    INDEX `production_issues_tenantId_issueType_idx`(`tenantId`, `issueType`),
    INDEX `production_issues_tenantId_severity_idx`(`tenantId`, `severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_downtimes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NULL,
    `operationId` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `issueId` VARCHAR(191) NULL,
    `workCentreId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `scope` ENUM('TASK', 'MACHINE', 'WORK_ORDER') NOT NULL DEFAULT 'TASK',
    `reasonType` ENUM('MATERIAL_SHORTAGE', 'MACHINE_BREAKDOWN', 'TOOL_UNAVAILABLE', 'POWER_FAILURE', 'QUALITY_HOLD', 'OPERATOR_UNAVAILABLE', 'DRAWING_ISSUE', 'SPECIFICATION_ISSUE', 'MAINTENANCE_REQUIRED', 'VENDOR_DELAY', 'SAFETY_CONCERN', 'OTHER') NULL,
    `reasonLabel` VARCHAR(200) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `durationMinutes` INTEGER NULL,
    `startedBy` VARCHAR(191) NULL,
    `endedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `production_downtimes_tenantId_idx`(`tenantId`),
    INDEX `production_downtimes_tenantId_productionOrderId_idx`(`tenantId`, `productionOrderId`),
    INDEX `production_downtimes_tenantId_assignmentId_endedAt_idx`(`tenantId`, `assignmentId`, `endedAt`),
    INDEX `production_downtimes_tenantId_machineId_endedAt_idx`(`tenantId`, `machineId`, `endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `production_order_stages` ADD CONSTRAINT `production_order_stages_assignedMachineId_fkey` FOREIGN KEY (`assignedMachineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_assignedMachineId_fkey` FOREIGN KEY (`assignedMachineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_assignments` ADD CONSTRAINT `production_assignments_reassignedFromId_fkey` FOREIGN KEY (`reassignedFromId`) REFERENCES `production_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_production_batches` ADD CONSTRAINT `daily_production_batches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `daily_production_batches` ADD CONSTRAINT `daily_production_batches_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `daily_production_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `production_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `daily_production_lines` ADD CONSTRAINT `daily_production_lines_resultingLedgerTransactionId_fkey` FOREIGN KEY (`resultingLedgerTransactionId`) REFERENCES `production_stage_ledger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `production_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_issues` ADD CONSTRAINT `production_issues_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `production_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `production_issues`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_downtimes` ADD CONSTRAINT `production_downtimes_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
