-- Period-close adjustment wizards: month-end accruals + prepaid amortisation.

-- Existing value order preserved verbatim; the two new keys are appended so MySQL can alter in place.
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
    'PREPAID_EXPENSE_ASSET'
  ) NOT NULL;

CREATE TABLE `period_end_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `kind` ENUM('ACCRUAL', 'PREPAID') NOT NULL,
    `adjustmentNumber` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'READY_TO_POST', 'POSTED', 'PARTIALLY_RECOGNISED', 'FULLY_RECOGNISED', 'REVERSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `description` VARCHAR(300) NOT NULL,
    `narration` VARCHAR(500) NULL,
    `expenseAccountId` VARCHAR(191) NOT NULL,
    `balanceSheetAccountId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(18, 4) NOT NULL,
    `recognisedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currencyCode` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `costCentreId` VARCHAR(191) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `projectReference` VARCHAR(64) NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `autoReverse` BOOLEAN NOT NULL DEFAULT true,
    `reversalPeriodId` VARCHAR(191) NULL,
    `numberOfPeriods` INTEGER NULL,
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
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `period_end_adjustments_tenantId_adjustmentNumber_key`(`tenantId`, `adjustmentNumber`),
    INDEX `period_end_adjustments_tenantId_idx`(`tenantId`),
    INDEX `period_end_adjustments_legalEntityId_idx`(`legalEntityId`),
    INDEX `period_end_adjustments_periodId_idx`(`periodId`),
    INDEX `period_end_adjustments_legalEntityId_kind_status_idx`(`legalEntityId`, `kind`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `period_end_adjustment_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `adjustmentId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('PENDING', 'POSTED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `voucherNumber` VARCHAR(64) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `period_end_adjustment_schedules_adjustmentId_sequence_key`(`adjustmentId`, `sequence`),
    INDEX `period_end_adjustment_schedules_tenantId_idx`(`tenantId`),
    INDEX `period_end_adjustment_schedules_periodId_idx`(`periodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_reversalPeriodId_fkey` FOREIGN KEY (`reversalPeriodId`) REFERENCES `accounting_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_expenseAccountId_fkey` FOREIGN KEY (`expenseAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_balanceSheetAccountId_fkey` FOREIGN KEY (`balanceSheetAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustments` ADD CONSTRAINT `period_end_adjustments_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `period_end_adjustment_schedules` ADD CONSTRAINT `period_end_adjustment_schedules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustment_schedules` ADD CONSTRAINT `period_end_adjustment_schedules_adjustmentId_fkey` FOREIGN KEY (`adjustmentId`) REFERENCES `period_end_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `period_end_adjustment_schedules` ADD CONSTRAINT `period_end_adjustment_schedules_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
