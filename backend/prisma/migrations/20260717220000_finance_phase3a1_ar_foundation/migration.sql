-- Finance Phase 3A1 — AR database foundation (SalesInvoice, ReceivableOpenItem, customer-party adapter tables only)

-- Extend finance document numbering enum (number series only — not AccountingVoucherType)
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
    'SALES_INVOICE'
  ) NOT NULL;

-- CreateTable
CREATE TABLE `sales_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `financialYearId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(64) NULL,
    `draftReference` VARCHAR(64) NULL,
    `status` ENUM('DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `customerId` VARCHAR(191) NOT NULL,
    `customerCodeSnapshot` VARCHAR(32) NULL,
    `customerNameSnapshot` VARCHAR(300) NOT NULL,
    `customerGstinSnapshot` VARCHAR(20) NULL,
    `customerPanSnapshot` VARCHAR(20) NULL,
    `customerBillingAddressSnapshot` JSON NULL,
    `sourceType` ENUM('DIRECT', 'SALES_ORDER') NOT NULL DEFAULT 'DIRECT',
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentSnapshot` JSON NULL,
    `invoiceDate` DATE NOT NULL,
    `dueDate` DATE NULL,
    `placeOfSupply` VARCHAR(8) NULL,
    `supplyType` ENUM('INTRA_STATE', 'INTER_STATE', 'EXPORT', 'SEZ', 'NON_GST') NOT NULL DEFAULT 'INTRA_STATE',
    `taxTreatment` ENUM('REGISTERED', 'UNREGISTERED', 'EXPORT_WITH_TAX', 'EXPORT_WITHOUT_TAX', 'SEZ_WITH_TAX', 'SEZ_WITHOUT_TAX', 'NON_GST') NOT NULL DEFAULT 'REGISTERED',
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `subtotalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `roundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseSubtotalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseDiscountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTaxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseSgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseIgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTotalTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseRoundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTotalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `narration` TEXT NULL,
    `accountingVoucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_inv_le_number_key`(`legalEntityId`, `invoiceNumber`),
    UNIQUE INDEX `sales_inv_le_draft_ref_key`(`legalEntityId`, `draftReference`),
    UNIQUE INDEX `sales_invoices_accountingVoucherId_key`(`accountingVoucherId`),
    UNIQUE INDEX `sales_invoices_postingEventId_key`(`postingEventId`),
    INDEX `sales_invoices_tenantId_idx`(`tenantId`),
    INDEX `sales_invoices_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `sales_invoices_legalEntityId_status_idx`(`legalEntityId`, `status`),
    INDEX `sales_invoices_legalEntityId_customerId_idx`(`legalEntityId`, `customerId`),
    INDEX `sales_invoices_legalEntityId_invoiceDate_idx`(`legalEntityId`, `invoiceDate`),
    INDEX `sales_invoices_legalEntityId_dueDate_idx`(`legalEntityId`, `dueDate`),
    INDEX `sales_inv_src_doc_idx`(`sourceType`, `sourceDocumentId`),
    INDEX `sales_invoices_financialYearId_idx`(`financialYearId`),
    INDEX `sales_invoices_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `salesInvoiceId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NULL,
    `itemNameSnapshot` VARCHAR(300) NULL,
    `hsnCodeSnapshot` VARCHAR(16) NULL,
    `uomSnapshot` VARCHAR(32) NULL,
    `description` VARCHAR(500) NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `unitRate` DECIMAL(18, 4) NOT NULL,
    `discountPercent` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cgstRate` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sgstRate` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `igstRate` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cessRate` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `cessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `revenueAccountId` VARCHAR(191) NULL,
    `costCentreId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_invoice_lines_salesInvoiceId_lineNumber_key`(`salesInvoiceId`, `lineNumber`),
    INDEX `sales_invoice_lines_tenantId_idx`(`tenantId`),
    INDEX `sales_invoice_lines_salesInvoiceId_idx`(`salesInvoiceId`),
    INDEX `sales_invoice_lines_itemId_idx`(`itemId`),
    INDEX `sales_invoice_lines_revenueAccountId_idx`(`revenueAccountId`),
    INDEX `sales_invoice_lines_costCentreId_idx`(`costCentreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receivable_open_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `documentType` ENUM('SALES_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE') NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentNumberSnapshot` VARCHAR(64) NULL,
    `salesInvoiceId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `customerNameSnapshot` VARCHAR(300) NULL,
    `receivableAccountId` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `originalAmount` DECIMAL(18, 4) NOT NULL,
    `openAmount` DECIMAL(18, 4) NOT NULL,
    `allocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `adjustedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `writtenOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseOriginalAmount` DECIMAL(18, 4) NOT NULL,
    `baseOpenAmount` DECIMAL(18, 4) NOT NULL,
    `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseAdjustedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseWrittenOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `documentDate` DATE NULL,
    `dueDate` DATE NULL,
    `status` ENUM('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'DISPUTED', 'ON_HOLD') NOT NULL DEFAULT 'OPEN',
    `accountingVoucherId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `recv_open_doc_key`(`tenantId`, `legalEntityId`, `documentType`, `documentId`),
    UNIQUE INDEX `receivable_open_items_salesInvoiceId_key`(`salesInvoiceId`),
    INDEX `receivable_open_items_tenantId_idx`(`tenantId`),
    INDEX `receivable_open_items_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `receivable_open_items_legalEntityId_customerId_idx`(`legalEntityId`, `customerId`),
    INDEX `receivable_open_items_legalEntityId_status_idx`(`legalEntityId`, `status`),
    INDEX `receivable_open_items_legalEntityId_dueDate_idx`(`legalEntityId`, `dueDate`),
    INDEX `receivable_open_items_receivableAccountId_idx`(`receivableAccountId`),
    INDEX `receivable_open_items_accountingVoucherId_idx`(`accountingVoucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_salesInvoiceId_fkey` FOREIGN KEY (`salesInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_revenueAccountId_fkey` FOREIGN KEY (`revenueAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_salesInvoiceId_fkey` FOREIGN KEY (`salesInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_receivableAccountId_fkey` FOREIGN KEY (`receivableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `receivable_open_items` ADD CONSTRAINT `receivable_open_items_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
