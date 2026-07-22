-- Manufacturing Phase 7A1 — warehouse role mapping + PRODUCTION_FG_RECEIPT code series

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT', 'MANUFACTURING_CORRECTION', 'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN', 'OUTBOUND_DISPATCH', 'PRODUCTION_FG_RECEIPT'
) NOT NULL;

CREATE TABLE `manufacturing_warehouse_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `plantCode` VARCHAR(32) NULL,
    `rawMaterialWarehouseId` VARCHAR(191) NOT NULL,
    `productionIssueWarehouseId` VARCHAR(191) NULL,
    `wipWarehouseId` VARCHAR(191) NULL,
    `finishedGoodsWarehouseId` VARCHAR(191) NOT NULL,
    `qualityHoldWarehouseId` VARCHAR(191) NULL,
    `reworkWarehouseId` VARCHAR(191) NULL,
    `scrapWarehouseId` VARCHAR(191) NULL,
    `jobWorkWarehouseId` VARCHAR(191) NULL,
    `defaultReturnWarehouseId` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `mfg_wh_map_tenant_plant_key`(`tenantId`, `plantCode`),
    INDEX `mfg_wh_map_tenant_idx`(`tenantId`),
    INDEX `mfg_wh_map_tenant_default_idx`(`tenantId`, `isDefault`, `isActive`),
    INDEX `mfg_wh_map_tenant_deleted_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `manufacturing_warehouse_mappings`
  ADD CONSTRAINT `mfg_wh_map_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_rm_wh_fkey`
    FOREIGN KEY (`rawMaterialWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_issue_wh_fkey`
    FOREIGN KEY (`productionIssueWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_wip_wh_fkey`
    FOREIGN KEY (`wipWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_fg_wh_fkey`
    FOREIGN KEY (`finishedGoodsWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_qh_wh_fkey`
    FOREIGN KEY (`qualityHoldWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_rework_wh_fkey`
    FOREIGN KEY (`reworkWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_scrap_wh_fkey`
    FOREIGN KEY (`scrapWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_jw_wh_fkey`
    FOREIGN KEY (`jobWorkWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `mfg_wh_map_return_wh_fkey`
    FOREIGN KEY (`defaultReturnWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
