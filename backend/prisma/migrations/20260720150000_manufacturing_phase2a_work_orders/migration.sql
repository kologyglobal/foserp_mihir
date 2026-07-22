-- AlterTable
ALTER TABLE `code_series` MODIFY `entityType` ENUM('USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER', 'PRODUCTION_DEMAND', 'PRODUCTION_ORDER') NOT NULL;

-- CreateTable
CREATE TABLE `production_demands` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `demandNumber` VARCHAR(64) NOT NULL,
    `sourceType` ENUM('SALES_ORDER', 'MANUAL', 'STOCK_REPLENISHMENT', 'PROJECT', 'REWORK', 'PRODUCTION_PLAN') NOT NULL,
    `sourceDocumentType` VARCHAR(32) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceLineReference` VARCHAR(64) NULL,
    `sourceLineKey` VARCHAR(150) NULL,
    `sourceSnapshotJson` JSON NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `projectRef` VARCHAR(100) NULL,
    `productItemId` VARCHAR(191) NOT NULL,
    `requestedQuantity` DECIMAL(18, 4) NOT NULL,
    `convertedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `remainingQuantity` DECIMAL(18, 4) NOT NULL,
    `cancelledQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NOT NULL,
    `requiredDate` DATETIME(3) NULL,
    `priority` VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    `plantCode` VARCHAR(32) NULL,
    `status` ENUM('OPEN', 'PARTIALLY_CONVERTED', 'FULLY_CONVERTED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `idempotencyKey` VARCHAR(150) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `production_demands_tenantId_idx`(`tenantId`),
    INDEX `production_demands_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `production_demands_tenantId_salesOrderId_idx`(`tenantId`, `salesOrderId`),
    INDEX `production_demands_tenantId_productItemId_idx`(`tenantId`, `productItemId`),
    INDEX `production_demands_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `production_demands_tenantId_demandNumber_key`(`tenantId`, `demandNumber`),
    UNIQUE INDEX `production_demands_tenantId_sourceLineKey_key`(`tenantId`, `sourceLineKey`),
    UNIQUE INDEX `production_demands_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_orders` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(64) NOT NULL,
    `demandId` VARCHAR(191) NULL,
    `sourceType` ENUM('SALES_ORDER', 'MANUAL', 'STOCK_REPLENISHMENT', 'PROJECT', 'REWORK', 'PRODUCTION_PLAN') NOT NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceLineReference` VARCHAR(64) NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `projectRef` VARCHAR(100) NULL,
    `productItemId` VARCHAR(191) NOT NULL,
    `manufacturingProfileId` VARCHAR(191) NOT NULL,
    `bomVersionId` VARCHAR(191) NOT NULL,
    `routingVersionId` VARCHAR(191) NULL,
    `plannedQuantity` DECIMAL(18, 4) NOT NULL,
    `completedGoodQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NOT NULL,
    `plantCode` VARCHAR(32) NULL,
    `plannedStartDate` DATETIME(3) NULL,
    `requiredCompletionDate` DATETIME(3) NOT NULL,
    `actualStartAt` DATETIME(3) NULL,
    `actualCompletedAt` DATETIME(3) NULL,
    `priority` VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    `managerId` VARCHAR(191) NULL,
    `supervisorId` VARCHAR(191) NULL,
    `jobNumber` VARCHAR(64) NULL,
    `outputTrackingType` ENUM('QUANTITY', 'LOT', 'BATCH', 'SERIAL', 'JOB', 'PROJECT', 'HEAT', 'PIECE') NOT NULL DEFAULT 'QUANTITY',
    `status` ENUM('DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `healthStatus` ENUM('ON_TRACK', 'ATTENTION', 'BLOCKED', 'DELAYED') NOT NULL DEFAULT 'ON_TRACK',
    `currentStageId` VARCHAR(191) NULL,
    `completionPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `materialControlStatus` ENUM('NOT_CONNECTED', 'PENDING_INVENTORY') NOT NULL DEFAULT 'NOT_CONNECTED',
    `qualityStatus` ENUM('NOT_APPLICABLE', 'PENDING_INTEGRATION') NOT NULL DEFAULT 'PENDING_INTEGRATION',
    `notes` TEXT NULL,
    `holdReasonCategory` ENUM('MATERIAL', 'MACHINE', 'QUALITY', 'DRAWING', 'CUSTOMER', 'PLANNING', 'OTHER') NULL,
    `holdRemarks` TEXT NULL,
    `holdExpectedResumeAt` DATETIME(3) NULL,
    `previousStatusBeforeHold` ENUM('DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED') NULL,
    `releasedAt` DATETIME(3) NULL,
    `releasedBy` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `production_orders_tenantId_idx`(`tenantId`),
    INDEX `production_orders_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `production_orders_tenantId_productItemId_idx`(`tenantId`, `productItemId`),
    INDEX `production_orders_tenantId_salesOrderId_idx`(`tenantId`, `salesOrderId`),
    INDEX `production_orders_tenantId_demandId_idx`(`tenantId`, `demandId`),
    INDEX `production_orders_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `production_orders_tenantId_orderNumber_key`(`tenantId`, `orderNumber`),
    UNIQUE INDEX `production_orders_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_bom_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `bomVersionId` VARCHAR(191) NOT NULL,
    `bomVersionNumber` INTEGER NOT NULL,
    `baseQuantity` DECIMAL(18, 4) NOT NULL,
    `baseUomId` VARCHAR(191) NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `production_order_bom_snapshots_productionOrderId_key`(`productionOrderId`),
    INDEX `production_order_bom_snapshots_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_bom_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `bomSnapshotId` VARCHAR(191) NOT NULL,
    `sourceBomLineId` VARCHAR(191) NULL,
    `parentLineId` VARCHAR(191) NULL,
    `sequence` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `descriptionOverride` VARCHAR(500) NULL,
    `perUnitQuantity` DECIMAL(18, 4) NOT NULL,
    `uomId` VARCHAR(191) NOT NULL,
    `scrapPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `requiredQuantity` DECIMAL(18, 4) NOT NULL,
    `makeOrBuy` ENUM('MAKE', 'BUY') NOT NULL,
    `lineType` ENUM('RAW_MATERIAL', 'BOUGHT_OUT', 'CONSUMABLE', 'SUBASSEMBLY', 'MANUFACTURED_COMPONENT', 'PACKAGING', 'SERVICE') NOT NULL,
    `issueStageGroupId` VARCHAR(191) NULL,
    `issueOperationId` VARCHAR(191) NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_order_bom_lines_tenantId_idx`(`tenantId`),
    INDEX `production_order_bom_lines_bomSnapshotId_sequence_idx`(`bomSnapshotId`, `sequence`),
    INDEX `production_order_bom_lines_tenantId_parentLineId_idx`(`tenantId`, `parentLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_routing_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `routingVersionId` VARCHAR(191) NOT NULL,
    `routingVersionNumber` INTEGER NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `production_order_routing_snapshots_productionOrderId_key`(`productionOrderId`),
    INDEX `production_order_routing_snapshots_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_stages` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `sourceStageGroupId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `displayOrder` INTEGER NOT NULL,
    `workCentreId` VARCHAR(191) NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `parallelAllowed` BOOLEAN NOT NULL DEFAULT false,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `completionRule` ENUM('ALL_OPERATIONS', 'ANY_OPERATION', 'MANUAL_CONFIRMATION', 'QUANTITY_TARGET') NOT NULL DEFAULT 'ALL_OPERATIONS',
    `status` ENUM('NOT_STARTED', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'QC_PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
    `plannedQuantity` DECIMAL(18, 4) NOT NULL,
    `goodQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `holdReasonCategory` ENUM('MATERIAL', 'MACHINE', 'QUALITY', 'DRAWING', 'CUSTOMER', 'PLANNING', 'OTHER') NULL,
    `holdRemarks` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `production_order_stages_tenantId_idx`(`tenantId`),
    INDEX `production_order_stages_productionOrderId_displayOrder_idx`(`productionOrderId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_operations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `sourceOperationId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `workCentreId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `setupTimeMinutes` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `runTimeValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `runTimeBasis` ENUM('PER_ORDER', 'PER_UNIT', 'PER_BATCH') NOT NULL DEFAULT 'PER_UNIT',
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('NOT_STARTED', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'QC_PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
    `plannedQuantity` DECIMAL(18, 4) NOT NULL,
    `goodQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `production_order_operations_tenantId_idx`(`tenantId`),
    INDEX `production_order_operations_productionOrderId_sequence_idx`(`productionOrderId`, `sequence`),
    INDEX `production_order_operations_stageId_idx`(`stageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_order_dependencies` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `predecessorOperationId` VARCHAR(191) NOT NULL,
    `successorOperationId` VARCHAR(191) NOT NULL,
    `dependencyType` ENUM('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH') NOT NULL DEFAULT 'FINISH_TO_START',
    `minimumCompletionPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_order_dependencies_tenantId_idx`(`tenantId`),
    INDEX `production_order_dependencies_productionOrderId_idx`(`productionOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_stage_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NULL,
    `transactionType` ENUM('STAGE_STARTED', 'PROGRESS_RECORDED', 'STAGE_COMPLETED', 'STAGE_HELD', 'STAGE_RESUMED', 'CORRECTION', 'REVERSAL') NOT NULL,
    `goodQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `reversalOfId` VARCHAR(191) NULL,
    `resultingBalanceJson` JSON NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_stage_ledger_tenantId_idx`(`tenantId`),
    INDEX `production_stage_ledger_productionOrderId_idx`(`productionOrderId`),
    INDEX `production_stage_ledger_stageId_idx`(`stageId`),
    UNIQUE INDEX `production_stage_ledger_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_activities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productionOrderId` VARCHAR(191) NOT NULL,
    `activityType` ENUM('CREATED', 'DEMAND_CREATED', 'DEMAND_CONVERTED', 'RELEASED', 'STARTED', 'HELD', 'RESUMED', 'STAGE_READY', 'STAGE_STARTED', 'PROGRESS_RECORDED', 'STAGE_COMPLETED', 'COMPLETED', 'CANCELLED', 'CORRECTION', 'ASSIGNED', 'DUE_DATE_CHANGED', 'PRIORITY_CHANGED') NOT NULL,
    `userId` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `reason` TEXT NULL,
    `sourceTransactionId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_activities_tenantId_idx`(`tenantId`),
    INDEX `production_activities_productionOrderId_createdAt_idx`(`productionOrderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `production_demands` ADD CONSTRAINT `production_demands_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_demands` ADD CONSTRAINT `production_demands_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `crm_sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_demands` ADD CONSTRAINT `production_demands_productItemId_fkey` FOREIGN KEY (`productItemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_demands` ADD CONSTRAINT `production_demands_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_demandId_fkey` FOREIGN KEY (`demandId`) REFERENCES `production_demands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `crm_sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_productItemId_fkey` FOREIGN KEY (`productItemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_manufacturingProfileId_fkey` FOREIGN KEY (`manufacturingProfileId`) REFERENCES `manufacturing_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `manufacturing_bom_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_routingVersionId_fkey` FOREIGN KEY (`routingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_snapshots` ADD CONSTRAINT `production_order_bom_snapshots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_snapshots` ADD CONSTRAINT `production_order_bom_snapshots_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_snapshots` ADD CONSTRAINT `production_order_bom_snapshots_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `manufacturing_bom_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_snapshots` ADD CONSTRAINT `production_order_bom_snapshots_baseUomId_fkey` FOREIGN KEY (`baseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_lines` ADD CONSTRAINT `production_order_bom_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_lines` ADD CONSTRAINT `production_order_bom_lines_bomSnapshotId_fkey` FOREIGN KEY (`bomSnapshotId`) REFERENCES `production_order_bom_snapshots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_lines` ADD CONSTRAINT `production_order_bom_lines_parentLineId_fkey` FOREIGN KEY (`parentLineId`) REFERENCES `production_order_bom_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_lines` ADD CONSTRAINT `production_order_bom_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_bom_lines` ADD CONSTRAINT `production_order_bom_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_routing_snapshots` ADD CONSTRAINT `production_order_routing_snapshots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_routing_snapshots` ADD CONSTRAINT `production_order_routing_snapshots_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_routing_snapshots` ADD CONSTRAINT `production_order_routing_snapshots_routingVersionId_fkey` FOREIGN KEY (`routingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_stages` ADD CONSTRAINT `production_order_stages_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_stages` ADD CONSTRAINT `production_order_stages_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_stages` ADD CONSTRAINT `production_order_stages_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_operations` ADD CONSTRAINT `production_order_operations_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_dependencies` ADD CONSTRAINT `production_order_dependencies_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_dependencies` ADD CONSTRAINT `production_order_dependencies_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_dependencies` ADD CONSTRAINT `production_order_dependencies_predecessorOperationId_fkey` FOREIGN KEY (`predecessorOperationId`) REFERENCES `production_order_operations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_order_dependencies` ADD CONSTRAINT `production_order_dependencies_successorOperationId_fkey` FOREIGN KEY (`successorOperationId`) REFERENCES `production_order_operations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_stage_ledger` ADD CONSTRAINT `production_stage_ledger_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_stage_ledger` ADD CONSTRAINT `production_stage_ledger_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_stage_ledger` ADD CONSTRAINT `production_stage_ledger_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_stage_ledger` ADD CONSTRAINT `production_stage_ledger_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_stage_ledger` ADD CONSTRAINT `production_stage_ledger_reversalOfId_fkey` FOREIGN KEY (`reversalOfId`) REFERENCES `production_stage_ledger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_activities` ADD CONSTRAINT `production_activities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_activities` ADD CONSTRAINT `production_activities_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
