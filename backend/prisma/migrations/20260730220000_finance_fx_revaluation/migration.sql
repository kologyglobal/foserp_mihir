-- Period-close FX revaluation: closing rates + unrealized gain/loss runs.

-- Existing mappingKey order preserved; append new FX keys only.
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
    'GRIR_CLEARING',
    'PURCHASE_PRICE_VARIANCE',
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
    'MERCHANT_FEE_EXPENSE',
    'ACCRUED_EXPENSE_LIABILITY',
    'PREPAID_EXPENSE_ASSET',
    'UNREALIZED_FX_GAIN',
    'UNREALIZED_FX_LOSS'
  ) NOT NULL;

CREATE TABLE `fx_exchange_rates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL,
    `asOfDate` DATE NOT NULL,
    `rate` DECIMAL(18, 8) NOT NULL,
    `source` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    `notes` VARCHAR(300) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fx_exchange_rates_legalEntityId_currencyCode_asOfDate_key`(`legalEntityId`, `currencyCode`, `asOfDate`),
    INDEX `fx_exchange_rates_tenantId_idx`(`tenantId`),
    INDEX `fx_exchange_rates_legalEntityId_asOfDate_idx`(`legalEntityId`, `asOfDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fx_revaluation_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PREVIEWED', 'POSTED', 'REVERSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `asOfDate` DATE NOT NULL,
    `baseCurrency` VARCHAR(8) NOT NULL,
    `totalGain` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalLoss` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netGainLoss` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `gainAccountId` VARCHAR(191) NULL,
    `lossAccountId` VARCHAR(191) NULL,
    `gainAccountCode` VARCHAR(32) NULL,
    `gainAccountName` VARCHAR(200) NULL,
    `lossAccountCode` VARCHAR(32) NULL,
    `lossAccountName` VARCHAR(200) NULL,
    `reversalPeriodId` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `voucherNumber` VARCHAR(64) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,
    `reversalPostingEventId` VARCHAR(191) NULL,
    `reversalVoucherNumber` VARCHAR(64) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fx_revaluation_runs_legalEntityId_periodId_key`(`legalEntityId`, `periodId`),
    INDEX `fx_revaluation_runs_tenantId_idx`(`tenantId`),
    INDEX `fx_revaluation_runs_periodId_idx`(`periodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fx_revaluation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `sourceType` ENUM('AR_OPEN_ITEM', 'AP_OPEN_ITEM') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `accountOrParty` VARCHAR(300) NOT NULL,
    `glAccountId` VARCHAR(191) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL,
    `foreignAmount` DECIMAL(18, 4) NOT NULL,
    `originalRate` DECIMAL(18, 8) NOT NULL,
    `closingRate` DECIMAL(18, 8) NOT NULL,
    `bookValueBase` DECIMAL(18, 4) NOT NULL,
    `revaluedValueBase` DECIMAL(18, 4) NOT NULL,
    `gainLossBase` DECIMAL(18, 4) NOT NULL,
    `isAsset` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fx_revaluation_lines_runId_sourceType_sourceId_key`(`runId`, `sourceType`, `sourceId`),
    INDEX `fx_revaluation_lines_tenantId_idx`(`tenantId`),
    INDEX `fx_revaluation_lines_runId_idx`(`runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `fx_exchange_rates` ADD CONSTRAINT `fx_exchange_rates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fx_exchange_rates` ADD CONSTRAINT `fx_exchange_rates_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fx_revaluation_runs` ADD CONSTRAINT `fx_revaluation_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fx_revaluation_runs` ADD CONSTRAINT `fx_revaluation_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fx_revaluation_runs` ADD CONSTRAINT `fx_revaluation_runs_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fx_revaluation_runs` ADD CONSTRAINT `fx_revaluation_runs_reversalPeriodId_fkey` FOREIGN KEY (`reversalPeriodId`) REFERENCES `accounting_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `fx_revaluation_lines` ADD CONSTRAINT `fx_revaluation_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fx_revaluation_lines` ADD CONSTRAINT `fx_revaluation_lines_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `fx_revaluation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
