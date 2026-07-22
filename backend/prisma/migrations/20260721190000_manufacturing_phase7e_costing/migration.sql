-- Manufacturing Phase 7E — costing and accounting productionisation.
-- Additive only. DefaultAccountMapping remains the single account mapping source (ADR-039).

ALTER TABLE `manufacturing_machines`
  ADD COLUMN `costRate` DECIMAL(18,2) NULL;

ALTER TABLE `production_accounting_events`
  MODIFY COLUMN `eventType` ENUM(
    'MATERIAL_RESERVED','MATERIAL_ISSUED','MATERIAL_RETURNED','MATERIAL_CONSUMED',
    'WIP_MOVED','SEMI_FINISHED_RECEIVED','PRODUCTION_COMPLETED','FINISHED_GOODS_RECEIVED',
    'SCRAP_RECORDED','PRODUCTION_ORDER_CLOSED','LABOUR_ABSORPTION','MACHINE_ABSORPTION',
    'OVERHEAD_ABSORPTION','JOB_WORK_RECEIPT_COST','PRODUCTION_VARIANCE','MANUFACTURING_REVERSAL'
  ) NOT NULL,
  MODIFY COLUMN `status` ENUM(
    'RECORDED','POSTED','SKIPPED_ZERO','SKIPPED_FLAG_OFF','FAILED','REVERSED'
  ) NOT NULL DEFAULT 'RECORDED';

ALTER TABLE `default_account_mappings`
  MODIFY COLUMN `mappingKey` ENUM(
    'CUSTOMER_RECEIVABLE','VENDOR_PAYABLE','SALES_REVENUE','SALES_RETURN','PURCHASE','PURCHASE_RETURN',
    'RAW_MATERIAL_INVENTORY','WIP_INVENTORY','FINISHED_GOODS_INVENTORY','STOCK_ADJUSTMENT',
    'MATERIAL_CONSUMPTION','LABOUR_ABSORPTION','MACHINE_ABSORPTION','JOB_WORK_ABSORPTION',
    'PRODUCTION_OVERHEAD_ABSORPTION','PRODUCTION_VARIANCE','SCRAP_INVENTORY','SCRAP_LOSS',
    'SUBCONTRACTING_EXPENSE','FREIGHT_INWARD','FREIGHT_OUTWARD','GST_INPUT_CGST','GST_INPUT_SGST',
    'GST_INPUT_IGST','GST_OUTPUT_CGST','GST_OUTPUT_SGST','GST_OUTPUT_IGST','GST_OUTPUT_CESS',
    'TDS_RECEIVABLE','TDS_PAYABLE','BANK_CHARGES','ROUNDING','DEPRECIATION_EXPENSE',
    'ACCUMULATED_DEPRECIATION','ASSET_DISPOSAL_GAIN','ASSET_DISPOSAL_LOSS','FIXED_ASSET_CLEARING',
    'RETAINED_EARNINGS','INTERNAL_TRANSFER_CLEARING','CHEQUE_RECEIPT_CLEARING',
    'CHEQUE_PAYMENT_CLEARING','BANK_INTEREST_INCOME','BANK_INTEREST_EXPENSE',
    'COLLECTION_FEE_EXPENSE','MERCHANT_FEE_EXPENSE'
  ) NOT NULL;

CREATE TABLE `manufacturing_costing_policies` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `plantCode` VARCHAR(32) NULL,
  `name` VARCHAR(191) NOT NULL,
  `costingMethod` ENUM('ACTUAL','PLANNED_AS_PROVISIONAL') NOT NULL DEFAULT 'PLANNED_AS_PROVISIONAL',
  `materialValuationSource` ENUM('MOVEMENT_UNIT_COST','PROVISIONAL_RATE') NOT NULL DEFAULT 'MOVEMENT_UNIT_COST',
  `labourRateSource` ENUM('WORK_CENTRE_RATE','TENANT_DEFAULT') NOT NULL DEFAULT 'WORK_CENTRE_RATE',
  `machineRateSource` ENUM('MACHINE_RATE','WORK_CENTRE_RATE') NOT NULL DEFAULT 'MACHINE_RATE',
  `jobWorkCostSource` ENUM('LINKED_INVOICE','APPROVED_CHARGE','PROVISIONAL_RATE') NOT NULL DEFAULT 'LINKED_INVOICE',
  `overheadMethod` ENUM('NONE','PER_LABOUR_HOUR','PER_MACHINE_HOUR','PER_GOOD_UNIT','PERCENT_OF_MATERIAL_COST') NOT NULL DEFAULT 'NONE',
  `overheadRate` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `defaultLabourRate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `defaultMachineRate` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `fgPostingMode` ENUM('MANUAL','NONE') NOT NULL DEFAULT 'MANUAL',
  `variancePostingMode` ENUM('MANUAL','NONE') NOT NULL DEFAULT 'MANUAL',
  `status` ENUM('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `effectiveFrom` DATE NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfg_cost_policy_tenant_name_key` (`tenantId`,`name`),
  INDEX `mfg_cost_policy_tenant_status_idx` (`tenantId`,`status`),
  INDEX `mfg_cost_policy_plant_status_idx` (`tenantId`,`plantCode`,`status`),
  CONSTRAINT `mfg_cost_policy_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_cost_policy_le_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `work_order_cost_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `productionOrderId` VARCHAR(191) NOT NULL,
  `snapshotVersion` INTEGER NOT NULL,
  `snapshotType` ENUM('PLANNED','CURRENT_ACTUAL','FG_RECEIPT','WORK_ORDER_CLOSE','REVERSAL') NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `calculationDate` DATETIME(3) NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL,
  `plannedQuantity` DECIMAL(18,4) NOT NULL,
  `goodQuantity` DECIMAL(18,4) NOT NULL,
  `fgReceivedQuantity` DECIMAL(18,4) NOT NULL,
  `plannedMaterialCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `actualMaterialCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `plannedLabourCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `actualLabourCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `plannedMachineCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `actualMachineCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `plannedJobWorkCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `actualJobWorkCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `plannedOverheadCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `actualOverheadCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `scrapCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `reworkCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `totalPlannedCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `totalActualCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `totalPostedCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `provisionalCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `varianceAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `unitPlannedCost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `unitActualCost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `completenessStatus` VARCHAR(40) NOT NULL,
  `warningSummaryJson` JSON NULL,
  `sourceFingerprint` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `wo_cost_snapshot_version_key` (`tenantId`,`productionOrderId`,`snapshotVersion`),
  INDEX `wo_cost_snapshot_tenant_wo_idx` (`tenantId`,`productionOrderId`),
  INDEX `wo_cost_snapshot_tenant_type_idx` (`tenantId`,`snapshotType`),
  CONSTRAINT `wo_cost_snapshot_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `wo_cost_snapshot_wo_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `work_order_cost_entries` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `productionOrderId` VARCHAR(191) NOT NULL,
  `costSnapshotId` VARCHAR(191) NULL,
  `costCategory` ENUM('MATERIAL','LABOUR','MACHINE','JOB_WORK','OVERHEAD','SCRAP','REWORK','VARIANCE','REVERSAL') NOT NULL,
  `sourceEntityType` VARCHAR(64) NOT NULL,
  `sourceEntityId` VARCHAR(191) NOT NULL,
  `sourceTransactionDate` DATETIME(3) NOT NULL,
  `itemId` VARCHAR(191) NULL,
  `workCentreId` VARCHAR(191) NULL,
  `machineId` VARCHAR(191) NULL,
  `jobWorkOrderId` VARCHAR(191) NULL,
  `quantity` DECIMAL(18,4) NULL,
  `durationMinutes` INTEGER NULL,
  `rate` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `currencyCode` VARCHAR(8) NOT NULL,
  `provisional` BOOLEAN NOT NULL DEFAULT false,
  `reversalOfCostEntryId` VARCHAR(191) NULL,
  `accountingEventId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfg_cost_entry_source_key` (`tenantId`,`costCategory`,`sourceEntityType`,`sourceEntityId`),
  INDEX `mfg_cost_entry_tenant_wo_idx` (`tenantId`,`productionOrderId`),
  INDEX `mfg_cost_entry_tenant_cat_idx` (`tenantId`,`costCategory`),
  INDEX `mfg_cost_entry_snapshot_idx` (`costSnapshotId`),
  INDEX `mfg_cost_entry_event_idx` (`accountingEventId`),
  CONSTRAINT `mfg_cost_entry_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_cost_entry_wo_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_cost_entry_snapshot_fkey` FOREIGN KEY (`costSnapshotId`) REFERENCES `work_order_cost_snapshots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `mfg_cost_entry_event_fkey` FOREIGN KEY (`accountingEventId`) REFERENCES `production_accounting_events` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
