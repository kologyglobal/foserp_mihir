-- Finance Phase 5B1 — Internal treasury transfers (bank/cash), in-transit clearing, approval, reversal.
-- Additive only: enum extensions + new finance_settings columns + new treasury_transfers table.

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
    'TREASURY_TRANSFER'
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
    'TREASURY_TRANSFER'
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
    'INTERNAL_TRANSFER_CLEARING'
  ) NOT NULL;

-- AlterTable finance_settings — Phase 5B1 treasury transfer policy
ALTER TABLE `finance_settings`
  ADD COLUMN `treasuryTransferBankBalancePolicy` VARCHAR(16) NOT NULL DEFAULT 'WARN',
  ADD COLUMN `treasuryTransferRequireInTransit` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `treasuryTransferInTransitThreshold` DECIMAL(18, 4) NULL,
  ADD COLUMN `treasuryTransferApprovalLimit` DECIMAL(18, 4) NULL,
  ADD COLUMN `treasuryTransferPreventSelfApprove` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `treasuryTransferPreventDispatcherReceive` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable treasury_transfers
CREATE TABLE `treasury_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `sourceBranchId` VARCHAR(191) NULL,
    `destinationBranchId` VARCHAR(191) NULL,
    `sourceTreasuryAccountId` VARCHAR(191) NOT NULL,
    `destinationTreasuryAccountId` VARCHAR(191) NOT NULL,
    `sourceGlAccountId` VARCHAR(191) NOT NULL,
    `destinationGlAccountId` VARCHAR(191) NOT NULL,
    `inTransitGlAccountId` VARCHAR(191) NULL,
    `draftReference` VARCHAR(64) NOT NULL,
    `transferNumber` VARCHAR(64) NULL,
    `transferType` ENUM('BANK_TO_BANK', 'BANK_TO_CASH', 'CASH_TO_BANK', 'CASH_TO_CASH') NOT NULL,
    `postingMode` ENUM('DIRECT', 'IN_TRANSIT') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `transferPurpose` ENUM('FUND_MOVEMENT', 'CASH_REPLENISHMENT', 'CASH_DEPOSIT', 'BANK_ACCOUNT_BALANCING', 'INTER_BRANCH_FUNDING', 'PETTY_CASH_REPLENISHMENT', 'OTHER') NOT NULL,
    `transferDate` DATE NOT NULL,
    `sourcePostingDate` DATE NOT NULL,
    `expectedReceiptDate` DATE NULL,
    `destinationPostingDate` DATE NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `transferAmount` DECIMAL(18, 4) NOT NULL,
    `baseTransferAmount` DECIMAL(18, 4) NOT NULL,
    `externalReference` VARCHAR(128) NULL,
    `normalizedExternalReference` VARCHAR(128) NULL,
    `transferUniquenessKey` VARCHAR(300) NULL,
    `sourceAccountNameSnapshot` VARCHAR(200) NOT NULL,
    `sourceAccountTypeSnapshot` ENUM('BANK', 'CASH', 'CLEARING') NOT NULL,
    `sourceMaskedNumberSnapshot` VARCHAR(40) NULL,
    `destinationAccountNameSnapshot` VARCHAR(200) NOT NULL,
    `destinationAccountTypeSnapshot` ENUM('BANK', 'CASH', 'CLEARING') NOT NULL,
    `destinationMaskedNumberSnapshot` VARCHAR(40) NULL,
    `narration` TEXT NULL,
    `internalNote` TEXT NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `validationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
    `sourcePostingEventId` VARCHAR(191) NULL,
    `sourceVoucherId` VARCHAR(191) NULL,
    `destinationPostingEventId` VARCHAR(191) NULL,
    `destinationVoucherId` VARCHAR(191) NULL,
    `reversalSourcePostingEventId` VARCHAR(191) NULL,
    `reversalSourceVoucherId` VARCHAR(191) NULL,
    `reversalDestinationPostingEventId` VARCHAR(191) NULL,
    `reversalDestinationVoucherId` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `readyToPostAt` DATETIME(3) NULL,
    `readyToPostById` VARCHAR(191) NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `dispatchedById` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NULL,
    `receivedById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` VARCHAR(191) NULL,
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

    UNIQUE INDEX `treasury_transfers_transferUniquenessKey_key`(`transferUniquenessKey`),
    INDEX `treasury_transfers_tenantId_idx`(`tenantId`),
    INDEX `treasury_transfers_legalEntityId_idx`(`legalEntityId`),
    INDEX `treas_xfer_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `treasury_transfers_sourceTreasuryAccountId_idx`(`sourceTreasuryAccountId`),
    INDEX `treasury_transfers_destinationTreasuryAccountId_idx`(`destinationTreasuryAccountId`),
    INDEX `treasury_transfers_transferNumber_idx`(`transferNumber`),
    INDEX `treasury_transfers_draftReference_idx`(`draftReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey treasury_transfers
ALTER TABLE `treasury_transfers` ADD CONSTRAINT `treasury_transfers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_transfers` ADD CONSTRAINT `treasury_transfers_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_transfers` ADD CONSTRAINT `treasury_transfers_sourceTreasuryAccountId_fkey` FOREIGN KEY (`sourceTreasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_transfers` ADD CONSTRAINT `treasury_transfers_destinationTreasuryAccountId_fkey` FOREIGN KEY (`destinationTreasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
