-- Finance Phase 5B2 — Cheque management (issued/received cheques, PDC tracking, lifecycle,
-- optional GL posting on issue/deposit, bounce/stop/reverse). Additive only.
-- Out of scope: MT940/CAMT, bank APIs, FX/intercompany.

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
    'TREASURY_CHEQUE'
  ) NOT NULL;

-- Extend finance approval document type enum
ALTER TABLE `finance_approval_requests`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'PAYMENT',
    'RECEIPT',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'PERIOD_REOPEN',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_ADJUSTMENT',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE'
  ) NOT NULL;

-- Extend default account mapping key enum
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
    'CHEQUE_PAYMENT_CLEARING'
  ) NOT NULL;

-- AlterTable finance_settings — Phase 5B2 cheque policy
ALTER TABLE `finance_settings`
  ADD COLUMN `treasuryChequeApprovalLimit` DECIMAL(18, 4) NULL,
  ADD COLUMN `treasuryChequePreventSelfApprove` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `treasuryChequeRequireCounterpartAccount` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable treasury_cheques
CREATE TABLE `treasury_cheques` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `glAccountId` VARCHAR(191) NOT NULL,
    `counterpartGlAccountId` VARCHAR(191) NULL,
    `direction` ENUM('ISSUED', 'RECEIVED') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY', 'ISSUED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'STOPPED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `accountingMode` ENUM('TRACK_ONLY', 'POST_ON_LIFECYCLE') NOT NULL DEFAULT 'POST_ON_LIFECYCLE',
    `draftReference` VARCHAR(64) NOT NULL,
    `chequeRegisterNumber` VARCHAR(64) NULL,
    `chequeNumber` VARCHAR(32) NOT NULL,
    `chequeDate` DATE NOT NULL,
    `bankName` VARCHAR(200) NULL,
    `branchName` VARCHAR(200) NULL,
    `ifsc` VARCHAR(20) NULL,
    `payeeOrDrawerName` VARCHAR(200) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `amount` DECIMAL(18, 4) NOT NULL,
    `baseAmount` DECIMAL(18, 4) NOT NULL,
    `isPdc` BOOLEAN NOT NULL DEFAULT false,
    `pdcMaturityDate` DATE NULL,
    `depositDate` DATE NULL,
    `clearanceDate` DATE NULL,
    `bounceDate` DATE NULL,
    `bounceReason` VARCHAR(500) NULL,
    `stopReason` VARCHAR(500) NULL,
    `customerReceiptId` VARCHAR(191) NULL,
    `vendorPaymentId` VARCHAR(191) NULL,
    `narration` TEXT NULL,
    `internalNote` TEXT NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `validationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
    `postingEventId` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,
    `reversalPostingEventId` VARCHAR(191) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,
    `uniquenessKey` VARCHAR(300) NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `readyAt` DATETIME(3) NULL,
    `readyById` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NULL,
    `issuedById` VARCHAR(191) NULL,
    `depositedAt` DATETIME(3) NULL,
    `depositedById` VARCHAR(191) NULL,
    `clearedAt` DATETIME(3) NULL,
    `clearedById` VARCHAR(191) NULL,
    `bouncedAt` DATETIME(3) NULL,
    `bouncedById` VARCHAR(191) NULL,
    `stoppedAt` DATETIME(3) NULL,
    `stoppedById` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedById` VARCHAR(191) NULL,
    `reversalDate` DATE NULL,
    `reversalReason` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treasury_cheques_uniquenessKey_key`(`uniquenessKey`),
    INDEX `treasury_cheques_tenantId_idx`(`tenantId`),
    INDEX `treas_chq_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `treasury_cheques_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `treasury_cheques_chequeNumber_idx`(`chequeNumber`),
    INDEX `treasury_cheques_draftReference_idx`(`draftReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey treasury_cheques
ALTER TABLE `treasury_cheques` ADD CONSTRAINT `treasury_cheques_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_cheques` ADD CONSTRAINT `treasury_cheques_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_cheques` ADD CONSTRAINT `treasury_cheques_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
