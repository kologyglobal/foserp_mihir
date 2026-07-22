-- Manufacturing Phase 1 — Foundation & Masters
-- Work Centres, Machines, BOM (header/version/line), Routing (header/version/stage
-- group/operation/dependency), Manufacturing Profile. No Production Order / execution
-- tables in this phase.

-- CreateTable
CREATE TABLE `manufacturing_work_centres` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `plantCode` VARCHAR(32) NULL,
    `departmentRef` VARCHAR(100) NULL,
    `locationId` VARCHAR(191) NULL,
    `capacityPerShift` DECIMAL(18, 4) NULL,
    `capacityUomId` VARCHAR(191) NULL,
    `defaultShiftRef` VARCHAR(64) NULL,
    `costRate` DECIMAL(18, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_work_centres_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_work_centres_tenantId_isActive_idx`(`tenantId`, `isActive`),
    INDEX `manufacturing_work_centres_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_work_centres_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_machines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `workCentreId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `manufacturer` VARCHAR(200) NULL,
    `model` VARCHAR(200) NULL,
    `serialNumber` VARCHAR(100) NULL,
    `capacity` DECIMAL(18, 4) NULL,
    `capacityUomId` VARCHAR(191) NULL,
    `status` ENUM('AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE') NOT NULL DEFAULT 'AVAILABLE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_machines_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_machines_tenantId_workCentreId_idx`(`tenantId`, `workCentreId`),
    INDEX `manufacturing_machines_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_machines_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_boms` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `productItemId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_boms_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_boms_tenantId_productItemId_idx`(`tenantId`, `productItemId`),
    INDEX `manufacturing_boms_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_boms_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_bom_versions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `bomId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `revisionCode` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `baseQuantity` DECIMAL(18, 4) NOT NULL,
    `baseUomId` VARCHAR(191) NOT NULL,
    `expectedYieldPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    `drawingRevision` VARCHAR(64) NULL,
    `revisionNotes` TEXT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_bom_versions_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_bom_versions_tenantId_bomId_status_idx`(`tenantId`, `bomId`, `status`),
    INDEX `manufacturing_bom_versions_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_bom_versions_tenantId_bomId_versionNumber_key`(`tenantId`, `bomId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_bom_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `bomVersionId` VARCHAR(191) NOT NULL,
    `parentLineId` VARCHAR(191) NULL,
    `sequence` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `descriptionOverride` VARCHAR(500) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `uomId` VARCHAR(191) NOT NULL,
    `quantityBasis` ENUM('PER_UNIT', 'FIXED_PER_ORDER', 'PER_BATCH') NOT NULL DEFAULT 'PER_UNIT',
    `fixedQuantity` DECIMAL(18, 4) NULL,
    `scrapPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `yieldPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    `makeOrBuy` ENUM('MAKE', 'BUY') NOT NULL DEFAULT 'MAKE',
    `lineType` ENUM('RAW_MATERIAL', 'BOUGHT_OUT', 'CONSUMABLE', 'SUBASSEMBLY', 'MANUFACTURED_COMPONENT', 'PACKAGING', 'SERVICE') NOT NULL,
    `issueStageGroupId` VARCHAR(36) NULL,
    `issueOperationId` VARCHAR(36) NULL,
    `consumptionMethod` ENUM('BACKFLUSH', 'ACTUAL', 'MANUAL_ADJUSTED') NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `substituteAllowed` BOOLEAN NOT NULL DEFAULT false,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `certificateRequired` BOOLEAN NOT NULL DEFAULT false,
    `childProductionOrderRequired` BOOLEAN NOT NULL DEFAULT false,
    `stockedSemiFinished` BOOLEAN NOT NULL DEFAULT false,
    `phantomAssembly` BOOLEAN NOT NULL DEFAULT false,
    `drawingReference` VARCHAR(64) NULL,
    `specification` TEXT NULL,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_bom_lines_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_bom_lines_bomVersionId_sequence_idx`(`bomVersionId`, `sequence`),
    INDEX `manufacturing_bom_lines_tenantId_parentLineId_idx`(`tenantId`, `parentLineId`),
    INDEX `manufacturing_bom_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
    INDEX `manufacturing_bom_lines_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_routings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `productItemId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_routings_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_routings_tenantId_productItemId_idx`(`tenantId`, `productItemId`),
    INDEX `manufacturing_routings_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_routings_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_routing_versions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `routingId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `revisionCode` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `revisionNotes` TEXT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_routing_versions_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_routing_versions_tenantId_routingId_status_idx`(`tenantId`, `routingId`, `status`),
    INDEX `manufacturing_routing_versions_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_routing_versions_tenantId_routingId_versionNum_key`(`tenantId`, `routingId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_stage_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `routingVersionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL,
    `defaultWorkCentreId` VARCHAR(191) NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `parallelAllowed` BOOLEAN NOT NULL DEFAULT false,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `completionRule` ENUM('ALL_OPERATIONS', 'ANY_OPERATION', 'MANUAL_CONFIRMATION', 'QUANTITY_TARGET') NOT NULL DEFAULT 'ALL_OPERATIONS',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_stage_groups_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_stage_groups_tenantId_routingVersionId_idx`(`tenantId`, `routingVersionId`),
    INDEX `manufacturing_stage_groups_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_stage_groups_routingVersionId_code_key`(`routingVersionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_routing_operations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `routingVersionId` VARCHAR(191) NOT NULL,
    `stageGroupId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `description` TEXT NULL,
    `workCentreId` VARCHAR(191) NULL,
    `defaultMachineId` VARCHAR(191) NULL,
    `setupTimeMinutes` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `runTimeValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `runTimeBasis` ENUM('PER_ORDER', 'PER_UNIT', 'PER_BATCH') NOT NULL DEFAULT 'PER_UNIT',
    `workInstructions` TEXT NULL,
    `drawingReference` VARCHAR(64) NULL,
    `inputType` ENUM('MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'NONE') NOT NULL DEFAULT 'MATERIAL',
    `outputType` ENUM('MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'NONE') NOT NULL DEFAULT 'NONE',
    `outputItemId` VARCHAR(191) NULL,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `qualityPlanRef` VARCHAR(64) NULL,
    `outsourced` BOOLEAN NOT NULL DEFAULT false,
    `defaultVendorId` VARCHAR(191) NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `isConditional` BOOLEAN NOT NULL DEFAULT false,
    `conditionExpression` TEXT NULL,
    `reworkAllowed` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_routing_operations_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_routing_operations_tenantId_routingVersionId_s_idx`(`tenantId`, `routingVersionId`, `sequence`),
    INDEX `manufacturing_routing_operations_tenantId_stageGroupId_idx`(`tenantId`, `stageGroupId`),
    INDEX `manufacturing_routing_operations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_routing_operations_routingVersionId_code_key`(`routingVersionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_operation_dependencies` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `routingVersionId` VARCHAR(191) NOT NULL,
    `predecessorOperationId` VARCHAR(191) NOT NULL,
    `successorOperationId` VARCHAR(191) NOT NULL,
    `dependencyType` ENUM('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH') NOT NULL DEFAULT 'FINISH_TO_START',
    `minimumCompletionPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `allowParallel` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_operation_dependencies_tenantId_idx`(`tenantId`),
    INDEX `manufacturing_operation_dependencies_tenantId_routingVersion_idx`(`tenantId`, `routingVersionId`),
    INDEX `manufacturing_operation_dependencies_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_operation_dependencies_routingVersionId_predec_key`(`routingVersionId`, `predecessorOperationId`, `successorOperationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `productItemId` VARCHAR(191) NOT NULL,
    `productionType` ENUM('ASSEMBLY', 'FABRICATION', 'MACHINING', 'JOB_SHOP', 'REPETITIVE', 'PROJECT', 'ENGINEER_TO_ORDER', 'SUBCONTRACT') NOT NULL,
    `executionMode` ENUM('SIMPLE', 'DETAILED') NOT NULL DEFAULT 'SIMPLE',
    `defaultBomVersionId` VARCHAR(191) NULL,
    `defaultRoutingVersionId` VARCHAR(191) NULL,
    `defaultQualityPlanRef` VARCHAR(64) NULL,
    `planningMethod` ENUM('MANUAL', 'SALES_ORDER', 'STOCK_REPLENISHMENT', 'PRODUCTION_PLAN') NOT NULL DEFAULT 'MANUAL',
    `materialConsumptionMethod` ENUM('BACKFLUSH', 'ACTUAL', 'MANUAL_ADJUSTED') NOT NULL DEFAULT 'BACKFLUSH',
    `wipTrackingMethod` ENUM('LOGICAL_WIP', 'STOCKED_SEMI_FINISHED', 'BOTH') NOT NULL DEFAULT 'LOGICAL_WIP',
    `outputTrackingMethod` ENUM('QUANTITY', 'LOT', 'BATCH', 'SERIAL', 'JOB', 'PROJECT', 'HEAT', 'PIECE') NOT NULL DEFAULT 'QUANTITY',
    `plantCode` VARCHAR(32) NULL,
    `productionWarehouseId` VARCHAR(191) NULL,
    `wipWarehouseId` VARCHAR(191) NULL,
    `finishedGoodsWarehouseId` VARCHAR(191) NULL,
    `scrapWarehouseId` VARCHAR(191) NULL,
    `directProductionOrderAllowed` BOOLEAN NOT NULL DEFAULT true,
    `partialCompletionAllowed` BOOLEAN NOT NULL DEFAULT true,
    `overproductionTolerancePercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `underproductionTolerancePercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `serialTrackingRequired` BOOLEAN NOT NULL DEFAULT false,
    `batchTrackingRequired` BOOLEAN NOT NULL DEFAULT false,
    `jobTrackingRequired` BOOLEAN NOT NULL DEFAULT false,
    `heatTrackingRequired` BOOLEAN NOT NULL DEFAULT false,
    `subcontractingAllowed` BOOLEAN NOT NULL DEFAULT false,
    `childProductionOrdersEnabled` BOOLEAN NOT NULL DEFAULT false,
    `approvalRuleRef` VARCHAR(64) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `manufacturing_profiles_tenantId_productItemId_isActive_idx`(`tenantId`, `productItemId`, `isActive`),
    INDEX `manufacturing_profiles_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `manufacturing_profiles_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `manufacturing_work_centres` ADD CONSTRAINT `manufacturing_work_centres_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_centres` ADD CONSTRAINT `manufacturing_work_centres_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_centres` ADD CONSTRAINT `manufacturing_work_centres_capacityUomId_fkey` FOREIGN KEY (`capacityUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_machines` ADD CONSTRAINT `manufacturing_machines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_machines` ADD CONSTRAINT `manufacturing_machines_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_machines` ADD CONSTRAINT `manufacturing_machines_capacityUomId_fkey` FOREIGN KEY (`capacityUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_boms` ADD CONSTRAINT `manufacturing_boms_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_boms` ADD CONSTRAINT `manufacturing_boms_productItemId_fkey` FOREIGN KEY (`productItemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_versions` ADD CONSTRAINT `manufacturing_bom_versions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_versions` ADD CONSTRAINT `manufacturing_bom_versions_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `manufacturing_boms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_versions` ADD CONSTRAINT `manufacturing_bom_versions_baseUomId_fkey` FOREIGN KEY (`baseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_lines` ADD CONSTRAINT `manufacturing_bom_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_lines` ADD CONSTRAINT `manufacturing_bom_lines_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `manufacturing_bom_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_lines` ADD CONSTRAINT `manufacturing_bom_lines_parentLineId_fkey` FOREIGN KEY (`parentLineId`) REFERENCES `manufacturing_bom_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_lines` ADD CONSTRAINT `manufacturing_bom_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_bom_lines` ADD CONSTRAINT `manufacturing_bom_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routings` ADD CONSTRAINT `manufacturing_routings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routings` ADD CONSTRAINT `manufacturing_routings_productItemId_fkey` FOREIGN KEY (`productItemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_versions` ADD CONSTRAINT `manufacturing_routing_versions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_versions` ADD CONSTRAINT `manufacturing_routing_versions_routingId_fkey` FOREIGN KEY (`routingId`) REFERENCES `manufacturing_routings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_stage_groups` ADD CONSTRAINT `manufacturing_stage_groups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_stage_groups` ADD CONSTRAINT `manufacturing_stage_groups_routingVersionId_fkey` FOREIGN KEY (`routingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_stage_groups` ADD CONSTRAINT `manufacturing_stage_groups_defaultWorkCentreId_fkey` FOREIGN KEY (`defaultWorkCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_routingVersionId_fkey` FOREIGN KEY (`routingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_stageGroupId_fkey` FOREIGN KEY (`stageGroupId`) REFERENCES `manufacturing_stage_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_defaultMachineId_fkey` FOREIGN KEY (`defaultMachineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_outputItemId_fkey` FOREIGN KEY (`outputItemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_routing_operations` ADD CONSTRAINT `manufacturing_routing_operations_defaultVendorId_fkey` FOREIGN KEY (`defaultVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_operation_dependencies` ADD CONSTRAINT `manufacturing_operation_dependencies_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_operation_dependencies` ADD CONSTRAINT `manufacturing_operation_dependencies_routingVersionId_fkey` FOREIGN KEY (`routingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_operation_dependencies` ADD CONSTRAINT `manufacturing_operation_dependencies_predecessorOperationId_fkey` FOREIGN KEY (`predecessorOperationId`) REFERENCES `manufacturing_routing_operations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_operation_dependencies` ADD CONSTRAINT `manufacturing_operation_dependencies_successorOperationId_fkey` FOREIGN KEY (`successorOperationId`) REFERENCES `manufacturing_routing_operations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_productItemId_fkey` FOREIGN KEY (`productItemId`) REFERENCES `master_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_defaultBomVersionId_fkey` FOREIGN KEY (`defaultBomVersionId`) REFERENCES `manufacturing_bom_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_defaultRoutingVersionId_fkey` FOREIGN KEY (`defaultRoutingVersionId`) REFERENCES `manufacturing_routing_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_productionWarehouseId_fkey` FOREIGN KEY (`productionWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_wipWarehouseId_fkey` FOREIGN KEY (`wipWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_finishedGoodsWarehouseId_fkey` FOREIGN KEY (`finishedGoodsWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_profiles` ADD CONSTRAINT `manufacturing_profiles_scrapWarehouseId_fkey` FOREIGN KEY (`scrapWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
