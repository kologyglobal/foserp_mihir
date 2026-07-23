-- Finance Fixed Assets Phase 4 — revaluation, impairment, maintenance, report fields.

ALTER TABLE `default_account_mappings`
  MODIFY `mappingKey` ENUM(
    'CUSTOMER_RECEIVABLE',
    'VENDOR_PAYABLE',
    'SALES_REVENUE',
    'SALES_RETURN',
    'PURCHASE',
    'PURCHASE_RETURN',
    'RAW_MATERIAL_INVENTORY',
    'WIP_INVENTORY',
    'FINISHED_GOODS_INVENTORY',
    'STOCK_ADJUSTMENT',
    'MATERIAL_CONSUMPTION',
    'COST_OF_GOODS_SOLD',
    'LABOUR_ABSORPTION',
    'MACHINE_ABSORPTION',
    'JOB_WORK_ABSORPTION',
    'PRODUCTION_OVERHEAD_ABSORPTION',
    'PRODUCTION_VARIANCE',
    'SCRAP_INVENTORY',
    'SCRAP_LOSS',
    'SUBCONTRACTING_EXPENSE',
    'FREIGHT_INWARD',
    'FREIGHT_OUTWARD',
    'GST_INPUT_CGST',
    'GST_INPUT_SGST',
    'GST_INPUT_IGST',
    'GST_OUTPUT_CGST',
    'GST_OUTPUT_SGST',
    'GST_OUTPUT_IGST',
    'GST_OUTPUT_CESS',
    'TDS_RECEIVABLE',
    'TDS_PAYABLE',
    'BANK_CHARGES',
    'ROUNDING',
    'DEPRECIATION_EXPENSE',
    'ACCUMULATED_DEPRECIATION',
    'ASSET_DISPOSAL_GAIN',
    'ASSET_DISPOSAL_LOSS',
    'FIXED_ASSET_CLEARING',
    'ASSET_REVALUATION_SURPLUS',
    'ASSET_IMPAIRMENT_LOSS',
    'RETAINED_EARNINGS',
    'INTERNAL_TRANSFER_CLEARING',
    'CHEQUE_RECEIPT_CLEARING',
    'CHEQUE_PAYMENT_CLEARING',
    'BANK_INTEREST_INCOME',
    'BANK_INTEREST_EXPENSE',
    'COLLECTION_FEE_EXPENSE',
    'MERCHANT_FEE_EXPENSE'
  ) NOT NULL;

ALTER TABLE `fixed_assets`
  ADD COLUMN `revaluationSurplus` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `accumulatedImpairment` DECIMAL(18, 4) NOT NULL DEFAULT 0;

CREATE TABLE `fixed_asset_revaluations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `revaluationNumber` VARCHAR(64) NOT NULL,
    `revaluationDate` DATE NOT NULL,
    `previousNbv` DECIMAL(18, 4) NOT NULL,
    `revaluedAmount` DECIMAL(18, 4) NOT NULL,
    `surplusAmount` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `reason` VARCHAR(1000) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_reval_le_number_key` ON `fixed_asset_revaluations`(`tenantId`, `legalEntityId`, `revaluationNumber`);
CREATE UNIQUE INDEX `fixed_asset_revaluations_postingEventId_key` ON `fixed_asset_revaluations`(`postingEventId`);
CREATE INDEX `fixed_asset_revaluations_tenantId_idx` ON `fixed_asset_revaluations`(`tenantId`);
CREATE INDEX `fa_reval_le_status_idx` ON `fixed_asset_revaluations`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_revaluations_assetId_idx` ON `fixed_asset_revaluations`(`assetId`);

ALTER TABLE `fixed_asset_revaluations` ADD CONSTRAINT `fixed_asset_revaluations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_revaluations` ADD CONSTRAINT `fixed_asset_revaluations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_revaluations` ADD CONSTRAINT `fixed_asset_revaluations_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_revaluations` ADD CONSTRAINT `fixed_asset_revaluations_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `fixed_asset_impairments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `impairmentNumber` VARCHAR(64) NOT NULL,
    `impairmentDate` DATE NOT NULL,
    `carryingAmount` DECIMAL(18, 4) NOT NULL,
    `recoverableAmount` DECIMAL(18, 4) NOT NULL,
    `impairmentLoss` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('DRAFT', 'RECOGNIZED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `reason` VARCHAR(1000) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_impair_le_number_key` ON `fixed_asset_impairments`(`tenantId`, `legalEntityId`, `impairmentNumber`);
CREATE UNIQUE INDEX `fixed_asset_impairments_postingEventId_key` ON `fixed_asset_impairments`(`postingEventId`);
CREATE INDEX `fixed_asset_impairments_tenantId_idx` ON `fixed_asset_impairments`(`tenantId`);
CREATE INDEX `fa_impair_le_status_idx` ON `fixed_asset_impairments`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_impairments_assetId_idx` ON `fixed_asset_impairments`(`assetId`);

ALTER TABLE `fixed_asset_impairments` ADD CONSTRAINT `fixed_asset_impairments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_impairments` ADD CONSTRAINT `fixed_asset_impairments_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_impairments` ADD CONSTRAINT `fixed_asset_impairments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_impairments` ADD CONSTRAINT `fixed_asset_impairments_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `fixed_asset_maintenance` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `maintenanceNumber` VARCHAR(64) NOT NULL,
    `type` ENUM('PREVENTIVE', 'BREAKDOWN', 'CALIBRATION', 'AMC', 'INSPECTION') NOT NULL,
    `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduledDate` DATE NOT NULL,
    `completedDate` DATE NULL,
    `vendorName` VARCHAR(200) NULL,
    `cost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `downtimeHours` DECIMAL(10, 2) NULL,
    `notes` VARCHAR(2000) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_maint_le_number_key` ON `fixed_asset_maintenance`(`tenantId`, `legalEntityId`, `maintenanceNumber`);
CREATE INDEX `fixed_asset_maintenance_tenantId_idx` ON `fixed_asset_maintenance`(`tenantId`);
CREATE INDEX `fa_maint_le_status_idx` ON `fixed_asset_maintenance`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_maintenance_assetId_idx` ON `fixed_asset_maintenance`(`assetId`);

ALTER TABLE `fixed_asset_maintenance` ADD CONSTRAINT `fixed_asset_maintenance_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_maintenance` ADD CONSTRAINT `fixed_asset_maintenance_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_maintenance` ADD CONSTRAINT `fixed_asset_maintenance_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
