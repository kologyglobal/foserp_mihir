-- Phase 3B1: Customer receipt & allocation DB foundation

-- FinanceDocumentType: CUSTOMER_RECEIPT
ALTER TABLE `finance_number_series` MODIFY `documentType` ENUM(
  'JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE',
  'OPENING_BALANCE', 'REVERSAL', 'SALES_INVOICE', 'CUSTOMER_RECEIPT'
) NOT NULL;

-- ReceivableDocumentType + side
ALTER TABLE `receivable_open_items` MODIFY `documentType` ENUM(
  'SALES_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'CUSTOMER_RECEIPT'
) NOT NULL;

ALTER TABLE `receivable_open_items`
  ADD COLUMN `side` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT' AFTER `branchId`,
  ADD COLUMN `customerReceiptId` VARCHAR(191) NULL AFTER `salesInvoiceId`;

UPDATE `receivable_open_items` SET `side` = 'DEBIT';

CREATE UNIQUE INDEX `receivable_open_items_customerReceiptId_key` ON `receivable_open_items`(`customerReceiptId`);
CREATE INDEX `receivable_open_items_tenant_le_side_status_idx` ON `receivable_open_items`(`tenantId`, `legalEntityId`, `side`, `status`);
CREATE INDEX `receivable_open_items_customerReceiptId_idx` ON `receivable_open_items`(`customerReceiptId`);

-- Customer receipts
CREATE TABLE `customer_receipts` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `financialYearId` VARCHAR(191) NULL,
  `receiptNumber` VARCHAR(64) NULL,
  `draftReference` VARCHAR(64) NULL,
  `status` ENUM('DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `customerId` VARCHAR(191) NOT NULL,
  `customerCodeSnapshot` VARCHAR(32) NULL,
  `customerNameSnapshot` VARCHAR(300) NOT NULL,
  `sourceType` ENUM('DIRECT', 'BANK_IMPORT') NOT NULL DEFAULT 'DIRECT',
  `paymentMethod` ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
  `receiptDate` DATE NOT NULL,
  `postingDate` DATE NULL,
  `referenceNumber` VARCHAR(64) NULL,
  `transactionReference` VARCHAR(100) NULL,
  `customerBankReference` VARCHAR(100) NULL,
  `chequeNumber` VARCHAR(64) NULL,
  `chequeDate` DATE NULL,
  `bankName` VARCHAR(200) NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
  `grossReceiptAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `customerTdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `bankChargeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `otherDeductionAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `bankCashAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `allocatableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `allocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `unallocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseGrossReceiptAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseCustomerTdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseBankChargeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseOtherDeductionAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseBankCashAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseAllocatableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseUnallocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `bankCashAccountId` VARCHAR(191) NULL,
  `customerReceivableAccountId` VARCHAR(191) NULL,
  `bankChargeAccountId` VARCHAR(191) NULL,
  `customerTdsReceivableAccountId` VARCHAR(191) NULL,
  `otherDeductionAccountId` VARCHAR(191) NULL,
  `accountingVoucherId` VARCHAR(191) NULL,
  `postingEventId` VARCHAR(191) NULL,
  `creditOpenItemId` VARCHAR(191) NULL,
  `narration` TEXT NULL,
  `internalRemarks` TEXT NULL,
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `cancellationReason` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `cust_rcpt_le_number_key`(`legalEntityId`, `receiptNumber`),
  UNIQUE INDEX `cust_rcpt_le_draft_ref_key`(`legalEntityId`, `draftReference`),
  UNIQUE INDEX `customer_receipts_accountingVoucherId_key`(`accountingVoucherId`),
  UNIQUE INDEX `customer_receipts_postingEventId_key`(`postingEventId`),
  UNIQUE INDEX `customer_receipts_creditOpenItemId_key`(`creditOpenItemId`),
  INDEX `customer_receipts_tenantId_idx`(`tenantId`),
  INDEX `customer_receipts_tenant_le_idx`(`tenantId`, `legalEntityId`),
  INDEX `customer_receipts_le_status_idx`(`legalEntityId`, `status`),
  INDEX `customer_receipts_le_customer_idx`(`legalEntityId`, `customerId`),
  INDEX `customer_receipts_le_receipt_date_idx`(`legalEntityId`, `receiptDate`),
  INDEX `customer_receipts_financialYearId_idx`(`financialYearId`),
  INDEX `customer_receipts_bankCashAccountId_idx`(`bankCashAccountId`),
  INDEX `customer_receipts_createdBy_idx`(`createdBy`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_receipt_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `receiptOpenItemId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `invoiceOpenItemId` VARCHAR(191) NOT NULL,
  `allocationDate` DATE NOT NULL,
  `postingDate` DATE NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
  `allocatedAmount` DECIMAL(18, 4) NOT NULL,
  `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL,
  `status` ENUM('DRAFT', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
  `allocationSequence` INT NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `reversalReason` VARCHAR(500) NULL,

  UNIQUE INDEX `cust_rcpt_alloc_seq_key`(`tenantId`, `legalEntityId`, `receiptId`, `allocationSequence`),
  INDEX `customer_receipt_allocations_receiptId_idx`(`receiptId`),
  INDEX `customer_receipt_allocations_invoiceId_idx`(`invoiceId`),
  INDEX `customer_receipt_allocations_receiptOpenItemId_idx`(`receiptOpenItemId`),
  INDEX `customer_receipt_allocations_invoiceOpenItemId_idx`(`invoiceOpenItemId`),
  INDEX `customer_receipt_allocations_customerId_idx`(`customerId`),
  INDEX `customer_receipt_allocations_status_idx`(`status`),
  INDEX `customer_receipt_allocations_allocationDate_idx`(`allocationDate`),
  INDEX `customer_receipt_allocations_tenant_le_idx`(`tenantId`, `legalEntityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `receivable_open_items`
  ADD CONSTRAINT `receivable_open_items_customerReceiptId_fkey`
    FOREIGN KEY (`customerReceiptId`) REFERENCES `customer_receipts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customer_receipts`
  ADD CONSTRAINT `customer_receipts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_bankCashAccountId_fkey` FOREIGN KEY (`bankCashAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_customerReceivableAccountId_fkey` FOREIGN KEY (`customerReceivableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_bankChargeAccountId_fkey` FOREIGN KEY (`bankChargeAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_customerTdsReceivableAccountId_fkey` FOREIGN KEY (`customerTdsReceivableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_otherDeductionAccountId_fkey` FOREIGN KEY (`otherDeductionAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipts_creditOpenItemId_fkey` FOREIGN KEY (`creditOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customer_receipt_allocations`
  ADD CONSTRAINT `customer_receipt_allocations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipt_allocations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipt_allocations_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `customer_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipt_allocations_receiptOpenItemId_fkey` FOREIGN KEY (`receiptOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipt_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_receipt_allocations_invoiceOpenItemId_fkey` FOREIGN KEY (`invoiceOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
