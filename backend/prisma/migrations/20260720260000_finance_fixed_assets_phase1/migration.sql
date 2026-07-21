-- Finance Fixed Assets Phase 1 — categories, register, capitalize + monthly straight-line depreciation.
-- Additive only. Out of scope: revaluation, impairment, transfers, PV, complex disposal.

-- Extend finance document numbering enum
ALTER TABLE `finance_number_series`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'RECEIPT',
    'PAYMENT',
    'CONTRA',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'OPENING_BALANCE',
    'REVERSAL',
    'SALES_INVOICE',
    'CUSTOMER_RECEIPT',
    'CUSTOMER_CREDIT_NOTE',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_DEBIT_NOTE',
    'VENDOR_CREDIT_ADJUSTMENT',
    'BANK_RECONCILIATION_MATCH',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE',
    'TREASURY_ADJUSTMENT',
    'FIXED_ASSET',
    'FA_DEPRECIATION_RUN'
  ) NOT NULL;

-- Extend default account mapping key enum (FA capitalization clearing)
ALTER TABLE `default_account_mappings`
  MODIFY COLUMN `mappingKey` ENUM(
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
    'RETAINED_EARNINGS',
    'INTERNAL_TRANSFER_CLEARING',
    'CHEQUE_RECEIPT_CLEARING',
    'CHEQUE_PAYMENT_CLEARING',
    'BANK_INTEREST_INCOME',
    'BANK_INTEREST_EXPENSE',
    'COLLECTION_FEE_EXPENSE',
    'MERCHANT_FEE_EXPENSE',
    'FIXED_ASSET_CLEARING'
  ) NOT NULL;

CREATE TABLE `fixed_asset_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `depreciationMethod` ENUM('STRAIGHT_LINE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `usefulLifeYears` INTEGER NOT NULL,
    `residualPercent` DECIMAL(5, 2) NOT NULL,
    `assetAccountId` VARCHAR(191) NOT NULL,
    `accumDepAccountId` VARCHAR(191) NOT NULL,
    `depExpenseAccountId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fixed_assets` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `assetNumber` VARCHAR(64) NOT NULL,
    `draftReference` VARCHAR(64) NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_CAPITALIZATION', 'ACTIVE', 'IDLE', 'FULLY_DEPRECIATED', 'DISPOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `acquisitionDate` DATE NOT NULL,
    `capitalizationDate` DATE NULL,
    `acquisitionCost` DECIMAL(18, 4) NOT NULL,
    `residualValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `usefulLifeYears` INTEGER NOT NULL,
    `depreciationMethod` ENUM('STRAIGHT_LINE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `accumulatedDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netBookValue` DECIMAL(18, 4) NOT NULL,
    `location` VARCHAR(200) NULL,
    `plant` VARCHAR(200) NULL,
    `department` VARCHAR(200) NULL,
    `custodian` VARCHAR(200) NULL,
    `serialNumber` VARCHAR(100) NULL,
    `manufacturer` VARCHAR(200) NULL,
    `model` VARCHAR(200) NULL,
    `vendorName` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `capitalizationVoucherId` VARCHAR(191) NULL,
    `capitalizationPostingEventId` VARCHAR(191) NULL,
    `capitalizedAt` DATETIME(3) NULL,
    `capitalizedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fixed_assets_capitalizationPostingEventId_key`(`capitalizationPostingEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fixed_asset_depreciation_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `runNumber` VARCHAR(64) NOT NULL,
    `periodKey` VARCHAR(7) NOT NULL,
    `periodFrom` DATE NOT NULL,
    `periodTo` DATE NOT NULL,
    `runDate` DATE NOT NULL,
    `postingDate` DATE NULL,
    `status` ENUM('DRAFT', 'PREVIEWED', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `assetCount` INTEGER NOT NULL DEFAULT 0,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fixed_asset_depreciation_runs_postingEventId_key`(`postingEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fixed_asset_depreciation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `assetNumber` VARCHAR(64) NOT NULL,
    `assetName` VARCHAR(200) NOT NULL,
    `categoryName` VARCHAR(200) NOT NULL,
    `openingNbv` DECIMAL(18, 4) NOT NULL,
    `depreciationAmount` DECIMAL(18, 4) NOT NULL,
    `closingNbv` DECIMAL(18, 4) NOT NULL,
    `accumulatedDepreciation` DECIMAL(18, 4) NOT NULL,
    `depExpenseAccountId` VARCHAR(191) NOT NULL,
    `accumDepAccountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_category_le_code_key` ON `fixed_asset_categories`(`legalEntityId`, `code`);
CREATE INDEX `fixed_asset_categories_tenantId_idx` ON `fixed_asset_categories`(`tenantId`);
CREATE INDEX `fa_category_le_active_idx` ON `fixed_asset_categories`(`tenantId`, `legalEntityId`, `isActive`);

CREATE UNIQUE INDEX `fa_asset_le_number_key` ON `fixed_assets`(`tenantId`, `legalEntityId`, `assetNumber`);
CREATE INDEX `fixed_assets_tenantId_idx` ON `fixed_assets`(`tenantId`);
CREATE INDEX `fa_asset_le_status_idx` ON `fixed_assets`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_assets_categoryId_idx` ON `fixed_assets`(`categoryId`);

CREATE UNIQUE INDEX `fa_dep_run_le_period_key` ON `fixed_asset_depreciation_runs`(`tenantId`, `legalEntityId`, `periodKey`);
CREATE UNIQUE INDEX `fa_dep_run_le_number_key` ON `fixed_asset_depreciation_runs`(`tenantId`, `legalEntityId`, `runNumber`);
CREATE INDEX `fixed_asset_depreciation_runs_tenantId_idx` ON `fixed_asset_depreciation_runs`(`tenantId`);
CREATE INDEX `fa_dep_run_le_status_idx` ON `fixed_asset_depreciation_runs`(`tenantId`, `legalEntityId`, `status`);

CREATE UNIQUE INDEX `fa_dep_line_num_key` ON `fixed_asset_depreciation_lines`(`runId`, `lineNumber`);
CREATE UNIQUE INDEX `fa_dep_line_asset_key` ON `fixed_asset_depreciation_lines`(`runId`, `assetId`);
CREATE INDEX `fixed_asset_depreciation_lines_tenantId_idx` ON `fixed_asset_depreciation_lines`(`tenantId`);
CREATE INDEX `fixed_asset_depreciation_lines_assetId_idx` ON `fixed_asset_depreciation_lines`(`assetId`);

ALTER TABLE `fixed_asset_categories`
  ADD CONSTRAINT `fixed_asset_categories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_categories_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_categories_assetAccountId_fkey` FOREIGN KEY (`assetAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_categories_accumDepAccountId_fkey` FOREIGN KEY (`accumDepAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_categories_depExpenseAccountId_fkey` FOREIGN KEY (`depExpenseAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fixed_assets`
  ADD CONSTRAINT `fixed_assets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_assets_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_assets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `fixed_asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_assets_capitalizationPostingEventId_fkey` FOREIGN KEY (`capitalizationPostingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_depreciation_runs`
  ADD CONSTRAINT `fixed_asset_depreciation_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_depreciation_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_depreciation_runs_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_depreciation_lines`
  ADD CONSTRAINT `fixed_asset_depreciation_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_depreciation_lines_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `fixed_asset_depreciation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fixed_asset_depreciation_lines_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
