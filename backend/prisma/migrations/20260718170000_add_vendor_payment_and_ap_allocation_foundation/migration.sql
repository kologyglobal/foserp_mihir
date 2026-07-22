-- Finance Phase 4B1 — Vendor payment + AP allocation database foundation
-- Additive only: no AR/journal/posting table alterations beyond enum extensions and PayableOpenItem column.

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
    'VENDOR_PAYMENT'
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
    'VENDOR_PAYMENT'
  ) NOT NULL;

-- CreateTable vendor_payments
CREATE TABLE `vendor_payments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `draftReference` VARCHAR(64) NOT NULL,
    `vendorPaymentNumber` VARCHAR(64) NULL,
    `paymentPurpose` ENUM('INVOICE_SETTLEMENT', 'ADVANCE', 'MIXED') NOT NULL,
    `paymentMethod` ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `documentDate` DATE NOT NULL,
    `paymentDate` DATE NOT NULL,
    `proposedPostingDate` DATE NULL,
    `valueDate` DATE NULL,
    `dueReferenceDate` DATE NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `vendorCodeSnapshot` VARCHAR(32) NOT NULL,
    `vendorNameSnapshot` VARCHAR(300) NOT NULL,
    `vendorGstinSnapshot` VARCHAR(20) NULL,
    `vendorPanSnapshot` VARCHAR(20) NULL,
    `vendorStateCodeSnapshot` VARCHAR(8) NULL,
    `vendorAddressSnapshot` JSON NULL,
    `paymentAccountId` VARCHAR(191) NULL,
    `vendorPayableAccountId` VARCHAR(191) NULL,
    `tdsPayableAccountId` VARCHAR(191) NULL,
    `discountAccountId` VARCHAR(191) NULL,
    `retentionAccountId` VARCHAR(191) NULL,
    `bankChargeAccountId` VARCHAR(191) NULL,
    `processingChargeAccountId` VARCHAR(191) NULL,
    `roundOffAccountId` VARCHAR(191) NULL,
    `otherAdjustmentAccountId` VARCHAR(191) NULL,
    `paymentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `settlementAdjustmentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paymentExpenseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `roundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vendorSettlementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cashOutflowAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `basePaymentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseSettlementAdjustmentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `basePaymentExpenseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseRoundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseVendorSettlementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCashOutflowAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `tdsBaseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `tdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsBaseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paymentReference` VARCHAR(100) NULL,
    `bankReference` VARCHAR(100) NULL,
    `chequeNumber` VARCHAR(64) NULL,
    `chequeDate` DATE NULL,
    `instrumentReference` VARCHAR(100) NULL,
    `narration` TEXT NULL,
    `beneficiarySnapshot` JSON NULL,
    `paymentInstructionSnapshot` JSON NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `calculationContext` JSON NULL,
    `calculationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
    `supplierUniquenessContext` JSON NULL,
    `accountingVoucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `payableOpenItemId` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedBy` VARCHAR(191) NULL,
    `readyToPostAt` DATETIME(3) NULL,
    `readyToPostBy` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_pay_tenant_draft_ref_key`(`tenantId`, `draftReference`),
    UNIQUE INDEX `vend_pay_tenant_le_number_key`(`tenantId`, `legalEntityId`, `vendorPaymentNumber`),
    UNIQUE INDEX `vendor_payments_approvalRequestId_key`(`approvalRequestId`),
    UNIQUE INDEX `vendor_payments_accountingVoucherId_key`(`accountingVoucherId`),
    UNIQUE INDEX `vendor_payments_postingEventId_key`(`postingEventId`),
    UNIQUE INDEX `vendor_payments_payableOpenItemId_key`(`payableOpenItemId`),
    INDEX `vendor_payments_tenantId_idx`(`tenantId`),
    INDEX `vendor_payments_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `vendor_payments_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `vendor_payments_tenantId_legalEntityId_vendorId_idx`(`tenantId`, `legalEntityId`, `vendorId`),
    INDEX `vendor_payments_tenantId_legalEntityId_paymentPurpose_idx`(`tenantId`, `legalEntityId`, `paymentPurpose`),
    INDEX `vendor_payments_tenantId_legalEntityId_paymentMethod_idx`(`tenantId`, `legalEntityId`, `paymentMethod`),
    INDEX `vendor_payments_tenantId_legalEntityId_paymentDate_idx`(`tenantId`, `legalEntityId`, `paymentDate`),
    INDEX `vendor_payments_tenantId_legalEntityId_financialYearId_idx`(`tenantId`, `legalEntityId`, `financialYearId`),
    INDEX `vendor_payments_financialYearId_idx`(`financialYearId`),
    INDEX `vendor_payments_branchId_idx`(`branchId`),
    INDEX `vendor_payments_paymentAccountId_idx`(`paymentAccountId`),
    INDEX `vendor_payments_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable vendor_payment_adjustment_lines
CREATE TABLE `vendor_payment_adjustment_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `vendorPaymentId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `adjustmentType` ENUM('TDS', 'DISCOUNT', 'RETENTION', 'WITHHOLDING', 'BANK_CHARGE', 'PROCESSING_CHARGE', 'ROUND_OFF', 'OTHER') NOT NULL,
    `accountingRole` ENUM('SETTLEMENT_CREDIT', 'PAYMENT_EXPENSE_DEBIT', 'ROUND_OFF_DEBIT', 'ROUND_OFF_CREDIT', 'INFORMATION_ONLY') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `baseAmount` DECIMAL(18, 4) NOT NULL,
    `calculationBaseAmount` DECIMAL(18, 4) NULL,
    `rate` DECIMAL(9, 4) NULL,
    `sectionCode` VARCHAR(32) NULL,
    `statutoryReference` VARCHAR(64) NULL,
    `accountId` VARCHAR(191) NULL,
    `costCentreId` VARCHAR(191) NULL,
    `projectReference` VARCHAR(64) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_pay_adj_line_seq_key`(`vendorPaymentId`, `lineNumber`),
    INDEX `vendor_payment_adjustment_lines_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `vendor_payment_adjustment_lines_vendorPaymentId_idx`(`vendorPaymentId`),
    INDEX `vendor_payment_adjustment_lines_adjustmentType_idx`(`adjustmentType`),
    INDEX `vendor_payment_adjustment_lines_accountingRole_idx`(`accountingRole`),
    INDEX `vendor_payment_adjustment_lines_accountId_idx`(`accountId`),
    INDEX `vendor_payment_adjustment_lines_costCentreId_idx`(`costCentreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_allocation_batches
CREATE TABLE `payable_allocation_batches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `allocationReference` VARCHAR(64) NOT NULL,
    `sourceDebitOpenItemId` VARCHAR(191) NOT NULL,
    `allocationDate` DATE NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `totalAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTotalAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'PARTIALLY_REVERSED', 'REVERSED') NOT NULL DEFAULT 'ACTIVE',
    `idempotencyKey` VARCHAR(128) NULL,
    `payloadHash` VARCHAR(128) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pay_alloc_batch_ref_key`(`tenantId`, `allocationReference`),
    UNIQUE INDEX `payable_allocation_batches_idempotencyKey_key`(`idempotencyKey`),
    INDEX `payable_allocation_batches_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `payable_allocation_batches_tenantId_legalEntityId_vendorId_idx`(`tenantId`, `legalEntityId`, `vendorId`),
    INDEX `payable_allocation_batches_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `payable_allocation_batches_sourceDebitOpenItemId_idx`(`sourceDebitOpenItemId`),
    INDEX `payable_allocation_batches_allocationDate_idx`(`allocationDate`),
    INDEX `payable_allocation_batches_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_allocation_lines
CREATE TABLE `payable_allocation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `allocationBatchId` VARCHAR(191) NOT NULL,
    `sourceDebitOpenItemId` VARCHAR(191) NOT NULL,
    `targetCreditOpenItemId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `baseAmount` DECIMAL(18, 4) NOT NULL,
    `reversedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseReversedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'PARTIALLY_REVERSED', 'REVERSED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pay_alloc_line_batch_target_key`(`allocationBatchId`, `targetCreditOpenItemId`),
    INDEX `payable_allocation_lines_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `payable_allocation_lines_allocationBatchId_idx`(`allocationBatchId`),
    INDEX `payable_allocation_lines_sourceDebitOpenItemId_idx`(`sourceDebitOpenItemId`),
    INDEX `payable_allocation_lines_targetCreditOpenItemId_idx`(`targetCreditOpenItemId`),
    INDEX `payable_allocation_lines_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable payable_open_items — source link for future payment/advance debit open items
ALTER TABLE `payable_open_items` ADD COLUMN `sourceVendorPaymentId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `payable_open_items_sourceVendorPaymentId_key` ON `payable_open_items`(`sourceVendorPaymentId`);

-- AddForeignKey vendor_payments
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `finance_approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_payableOpenItemId_fkey` FOREIGN KEY (`payableOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_paymentAccountId_fkey` FOREIGN KEY (`paymentAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_vendorPayableAccountId_fkey` FOREIGN KEY (`vendorPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_tdsPayableAccountId_fkey` FOREIGN KEY (`tdsPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_discountAccountId_fkey` FOREIGN KEY (`discountAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_retentionAccountId_fkey` FOREIGN KEY (`retentionAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_bankChargeAccountId_fkey` FOREIGN KEY (`bankChargeAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_processingChargeAccountId_fkey` FOREIGN KEY (`processingChargeAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_roundOffAccountId_fkey` FOREIGN KEY (`roundOffAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_otherAdjustmentAccountId_fkey` FOREIGN KEY (`otherAdjustmentAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey vendor_payment_adjustment_lines
ALTER TABLE `vendor_payment_adjustment_lines` ADD CONSTRAINT `vendor_payment_adjustment_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payment_adjustment_lines` ADD CONSTRAINT `vendor_payment_adjustment_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payment_adjustment_lines` ADD CONSTRAINT `vendor_payment_adjustment_lines_vendorPaymentId_fkey` FOREIGN KEY (`vendorPaymentId`) REFERENCES `vendor_payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_payment_adjustment_lines` ADD CONSTRAINT `vendor_payment_adjustment_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_payment_adjustment_lines` ADD CONSTRAINT `vendor_payment_adjustment_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey payable_allocation_batches
ALTER TABLE `payable_allocation_batches` ADD CONSTRAINT `payable_allocation_batches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_batches` ADD CONSTRAINT `payable_allocation_batches_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_batches` ADD CONSTRAINT `payable_allocation_batches_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_batches` ADD CONSTRAINT `payable_allocation_batches_sourceDebitOpenItemId_fkey` FOREIGN KEY (`sourceDebitOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey payable_allocation_lines
ALTER TABLE `payable_allocation_lines` ADD CONSTRAINT `payable_allocation_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_lines` ADD CONSTRAINT `payable_allocation_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_lines` ADD CONSTRAINT `payable_allocation_lines_allocationBatchId_fkey` FOREIGN KEY (`allocationBatchId`) REFERENCES `payable_allocation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_lines` ADD CONSTRAINT `payable_allocation_lines_sourceDebitOpenItemId_fkey` FOREIGN KEY (`sourceDebitOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_allocation_lines` ADD CONSTRAINT `payable_allocation_lines_targetCreditOpenItemId_fkey` FOREIGN KEY (`targetCreditOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey payable_open_items.sourceVendorPaymentId
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_sourceVendorPaymentId_fkey` FOREIGN KEY (`sourceVendorPaymentId`) REFERENCES `vendor_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
