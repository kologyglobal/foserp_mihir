-- Finance Phase 4A1 — Vendor invoice / AP open-item database foundation
-- Additive only: no AR/journal/posting table alterations beyond enum extensions.

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
    'VENDOR_INVOICE'
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
    'VENDOR_INVOICE'
  ) NOT NULL;

-- CreateTable vendor_invoices
CREATE TABLE `vendor_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `draftReference` VARCHAR(64) NOT NULL,
    `vendorInvoiceNumber` VARCHAR(64) NULL,
    `supplierInvoiceNumber` VARCHAR(128) NOT NULL,
    `supplierInvoiceNumberNormalized` VARCHAR(128) NOT NULL,
    `supplierInvoiceUniquenessKey` VARCHAR(512) NULL,
    `supplierInvoiceDate` DATE NOT NULL,
    `invoiceType` ENUM('GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `taxTreatment` ENUM('REGULAR', 'REVERSE_CHARGE', 'IMPORT_GOODS', 'IMPORT_SERVICE', 'SEZ', 'NON_GST', 'EXEMPT', 'NIL_RATED') NOT NULL DEFAULT 'REGULAR',
    `itcEligibility` ENUM('PENDING_REVIEW', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'INELIGIBLE') NOT NULL DEFAULT 'PENDING_REVIEW',
    `tdsRecognitionMode` ENUM('NOT_APPLICABLE', 'AT_INVOICE', 'AT_PAYMENT') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `documentDate` DATE NOT NULL,
    `postingDate` DATE NULL,
    `dueDate` DATE NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `vendorCodeSnapshot` VARCHAR(32) NOT NULL,
    `vendorNameSnapshot` VARCHAR(300) NOT NULL,
    `vendorGstinSnapshot` VARCHAR(20) NULL,
    `vendorPanSnapshot` VARCHAR(20) NULL,
    `vendorStateCodeSnapshot` VARCHAR(8) NULL,
    `vendorAddressSnapshot` JSON NULL,
    `companyGstinSnapshot` VARCHAR(20) NULL,
    `companyStateCodeSnapshot` VARCHAR(8) NULL,
    `placeOfSupplyStateCode` VARCHAR(8) NULL,
    `grossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `inputCgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `inputSgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `inputIgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `inputCessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `otherRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `nonRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `freightAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `otherChargeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `roundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `invoiceGrandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `tdsSectionCode` VARCHAR(32) NULL,
    `tdsSectionDescription` VARCHAR(200) NULL,
    `tdsRate` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `tdsBaseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `tdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vendorPayableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseGrossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseDiscountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTaxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseInputCgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseInputSgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseInputIgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseInputCessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseOtherRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseNonRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseFreightAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseOtherChargeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseRoundOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseInvoiceGrandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsBaseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseVendorPayableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vendorPayableAccountId` VARCHAR(191) NULL,
    `inputCgstAccountId` VARCHAR(191) NULL,
    `inputSgstAccountId` VARCHAR(191) NULL,
    `inputIgstAccountId` VARCHAR(191) NULL,
    `inputCessAccountId` VARCHAR(191) NULL,
    `otherRecoverableTaxAccountId` VARCHAR(191) NULL,
    `nonRecoverableTaxAccountId` VARCHAR(191) NULL,
    `tdsPayableAccountId` VARCHAR(191) NULL,
    `roundOffAccountId` VARCHAR(191) NULL,
    `paymentTermsDaysSnapshot` INTEGER NULL,
    `paymentTermsSnapshot` VARCHAR(200) NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `calculationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
    `accountingVoucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
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
    `reversedAt` DATETIME(3) NULL,
    `reversedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_inv_tenant_draft_ref_key`(`tenantId`, `draftReference`),
    UNIQUE INDEX `vend_inv_tenant_le_number_key`(`tenantId`, `legalEntityId`, `vendorInvoiceNumber`),
    UNIQUE INDEX `vendor_invoices_supplierInvoiceUniquenessKey_key`(`supplierInvoiceUniquenessKey`),
    UNIQUE INDEX `vendor_invoices_accountingVoucherId_key`(`accountingVoucherId`),
    UNIQUE INDEX `vendor_invoices_postingEventId_key`(`postingEventId`),
    INDEX `vendor_invoices_tenantId_idx`(`tenantId`),
    INDEX `vendor_invoices_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `vendor_invoices_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `vendor_invoices_tenantId_legalEntityId_vendorId_idx`(`tenantId`, `legalEntityId`, `vendorId`),
    INDEX `vendor_invoices_tenantId_legalEntityId_supplierInvoiceDate_idx`(`tenantId`, `legalEntityId`, `supplierInvoiceDate`),
    INDEX `vendor_invoices_tenantId_legalEntityId_dueDate_idx`(`tenantId`, `legalEntityId`, `dueDate`),
    INDEX `vendor_invoices_tenantId_legalEntityId_financialYearId_idx`(`tenantId`, `legalEntityId`, `financialYearId`),
    INDEX `vend_inv_supplier_num_idx`(`tenantId`, `legalEntityId`, `vendorId`, `supplierInvoiceNumberNormalized`),
    INDEX `vendor_invoices_financialYearId_idx`(`financialYearId`),
    INDEX `vendor_invoices_branchId_idx`(`branchId`),
    INDEX `vendor_invoices_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable vendor_invoice_lines
CREATE TABLE `vendor_invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `vendorInvoiceId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `lineType` ENUM('ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE') NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NULL,
    `itemNameSnapshot` VARCHAR(300) NULL,
    `description` VARCHAR(500) NOT NULL,
    `hsnSacCode` VARCHAR(16) NULL,
    `quantity` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `uomCodeSnapshot` VARCHAR(32) NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
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
    `otherRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `nonRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseGrossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseDiscountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTaxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseSgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseIgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseOtherRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseNonRecoverableTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseLineTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `debitAccountId` VARCHAR(191) NULL,
    `costCentreId` VARCHAR(191) NULL,
    `projectReference` VARCHAR(64) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `sourceLinkType` ENUM('PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_RECEIPT', 'CONTRACT', 'PROJECT', 'OTHER') NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentNumber` VARCHAR(64) NULL,
    `sourceDocumentLineId` VARCHAR(191) NULL,
    `taxTreatment` ENUM('REGULAR', 'REVERSE_CHARGE', 'IMPORT_GOODS', 'IMPORT_SERVICE', 'SEZ', 'NON_GST', 'EXEMPT', 'NIL_RATED') NULL,
    `itcEligibility` ENUM('PENDING_REVIEW', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'INELIGIBLE') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_inv_line_num_key`(`vendorInvoiceId`, `lineNumber`),
    INDEX `vendor_invoice_lines_tenantId_idx`(`tenantId`),
    INDEX `vendor_invoice_lines_legalEntityId_idx`(`legalEntityId`),
    INDEX `vendor_invoice_lines_vendorInvoiceId_idx`(`vendorInvoiceId`),
    INDEX `vendor_invoice_lines_itemId_idx`(`itemId`),
    INDEX `vendor_invoice_lines_debitAccountId_idx`(`debitAccountId`),
    INDEX `vendor_invoice_lines_costCentreId_idx`(`costCentreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable vendor_invoice_source_links
CREATE TABLE `vendor_invoice_source_links` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `vendorInvoiceId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_RECEIPT', 'CONTRACT', 'PROJECT', 'OTHER') NOT NULL,
    `sourceDocumentId` VARCHAR(191) NOT NULL,
    `sourceDocumentNumberSnapshot` VARCHAR(64) NULL,
    `sourceDocumentDateSnapshot` DATE NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vend_inv_src_link_key`(`vendorInvoiceId`, `sourceType`, `sourceDocumentId`),
    INDEX `vendor_invoice_source_links_tenantId_idx`(`tenantId`),
    INDEX `vendor_invoice_source_links_legalEntityId_idx`(`legalEntityId`),
    INDEX `vendor_invoice_source_links_vendorInvoiceId_idx`(`vendorInvoiceId`),
    INDEX `vend_inv_src_doc_idx`(`sourceType`, `sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_open_items
CREATE TABLE `payable_open_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorCodeSnapshot` VARCHAR(32) NOT NULL,
    `vendorNameSnapshot` VARCHAR(300) NOT NULL,
    `side` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `documentType` ENUM('VENDOR_INVOICE', 'VENDOR_PAYMENT', 'VENDOR_ADVANCE', 'VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT', 'OPENING_BALANCE') NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(64) NOT NULL,
    `documentDate` DATE NOT NULL,
    `postingDate` DATE NOT NULL,
    `dueDate` DATE NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `originalAmount` DECIMAL(18, 4) NOT NULL,
    `allocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `adjustedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `writtenOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `outstandingAmount` DECIMAL(18, 4) NOT NULL,
    `baseOriginalAmount` DECIMAL(18, 4) NOT NULL,
    `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseAdjustedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseWrittenOffAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseOutstandingAmount` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'ON_HOLD', 'DISPUTED', 'REVERSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `isDisputed` BOOLEAN NOT NULL DEFAULT false,
    `isOnHold` BOOLEAN NOT NULL DEFAULT false,
    `vendorPayableAccountId` VARCHAR(191) NOT NULL,
    `sourceVendorInvoiceId` VARCHAR(191) NULL,
    `accountingVoucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `settledAt` DATETIME(3) NULL,
    `reversedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pay_open_doc_key`(`tenantId`, `legalEntityId`, `documentType`, `documentId`),
    UNIQUE INDEX `payable_open_items_sourceVendorInvoiceId_key`(`sourceVendorInvoiceId`),
    INDEX `payable_open_items_tenantId_idx`(`tenantId`),
    INDEX `payable_open_items_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `pay_open_vendor_status_idx`(`tenantId`, `legalEntityId`, `vendorId`, `status`),
    INDEX `pay_open_status_due_idx`(`tenantId`, `legalEntityId`, `status`, `dueDate`),
    INDEX `pay_open_acct_status_idx`(`tenantId`, `legalEntityId`, `vendorPayableAccountId`, `status`),
    INDEX `pay_open_side_status_idx`(`tenantId`, `legalEntityId`, `side`, `status`),
    INDEX `payable_open_items_branchId_idx`(`branchId`),
    INDEX `payable_open_items_vendorId_idx`(`vendorId`),
    INDEX `payable_open_items_status_idx`(`status`),
    INDEX `payable_open_items_side_idx`(`side`),
    INDEX `payable_open_items_documentType_idx`(`documentType`),
    INDEX `payable_open_items_postingDate_idx`(`postingDate`),
    INDEX `payable_open_items_dueDate_idx`(`dueDate`),
    INDEX `payable_open_items_currencyCode_idx`(`currencyCode`),
    INDEX `payable_open_items_vendorPayableAccountId_idx`(`vendorPayableAccountId`),
    INDEX `payable_open_items_accountingVoucherId_idx`(`accountingVoucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys: VendorInvoice
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_vendorPayableAccountId_fkey` FOREIGN KEY (`vendorPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_inputCgstAccountId_fkey` FOREIGN KEY (`inputCgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_inputSgstAccountId_fkey` FOREIGN KEY (`inputSgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_inputIgstAccountId_fkey` FOREIGN KEY (`inputIgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_inputCessAccountId_fkey` FOREIGN KEY (`inputCessAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_otherRecoverableTaxAccountId_fkey` FOREIGN KEY (`otherRecoverableTaxAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_nonRecoverableTaxAccountId_fkey` FOREIGN KEY (`nonRecoverableTaxAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_tdsPayableAccountId_fkey` FOREIGN KEY (`tdsPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoices` ADD CONSTRAINT `vendor_invoices_roundOffAccountId_fkey` FOREIGN KEY (`roundOffAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: VendorInvoiceLine (cascade with invoice ownership)
ALTER TABLE `vendor_invoice_lines` ADD CONSTRAINT `vendor_invoice_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_lines` ADD CONSTRAINT `vendor_invoice_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_lines` ADD CONSTRAINT `vendor_invoice_lines_vendorInvoiceId_fkey` FOREIGN KEY (`vendorInvoiceId`) REFERENCES `vendor_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_lines` ADD CONSTRAINT `vendor_invoice_lines_debitAccountId_fkey` FOREIGN KEY (`debitAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_lines` ADD CONSTRAINT `vendor_invoice_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: VendorInvoiceSourceLink
ALTER TABLE `vendor_invoice_source_links` ADD CONSTRAINT `vendor_invoice_source_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_source_links` ADD CONSTRAINT `vendor_invoice_source_links_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_invoice_source_links` ADD CONSTRAINT `vendor_invoice_source_links_vendorInvoiceId_fkey` FOREIGN KEY (`vendorInvoiceId`) REFERENCES `vendor_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: PayableOpenItem
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_sourceVendorInvoiceId_fkey` FOREIGN KEY (`sourceVendorInvoiceId`) REFERENCES `vendor_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_vendorPayableAccountId_fkey` FOREIGN KEY (`vendorPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
