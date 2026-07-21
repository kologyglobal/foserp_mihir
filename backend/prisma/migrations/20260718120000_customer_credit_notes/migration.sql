-- Finance Phase 3C1-3C4: customer credit-note foundation and atomic posting.

ALTER TABLE `finance_number_series` MODIFY `documentType` ENUM(
  'JOURNAL','RECEIPT','PAYMENT','CONTRA','CREDIT_NOTE','DEBIT_NOTE',
  'OPENING_BALANCE','REVERSAL','SALES_INVOICE','CUSTOMER_RECEIPT','CUSTOMER_CREDIT_NOTE'
) NOT NULL;

ALTER TABLE `receivable_open_items` MODIFY `documentType` ENUM(
  'SALES_INVOICE','CREDIT_NOTE','CUSTOMER_CREDIT_NOTE','DEBIT_NOTE','OPENING_BALANCE','CUSTOMER_RECEIPT'
) NOT NULL;

CREATE TABLE `credit_note_reasons` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `purpose` ENUM('SALES_RETURN','PRICE_ADJUSTMENT','QUANTITY_ADJUSTMENT','QUALITY_CLAIM','DISCOUNT','FREIGHT_ADJUSTMENT','TAX_CORRECTION','COMMERCIAL_SETTLEMENT','OTHER') NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `allowsFullReversal` BOOLEAN NOT NULL DEFAULT false,
  `allowsTaxOnly` BOOLEAN NOT NULL DEFAULT false,
  `allowsQuantity` BOOLEAN NOT NULL DEFAULT true,
  `allowsValue` BOOLEAN NOT NULL DEFAULT true,
  `defaultAdjustmentAccountId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `credit_note_reasons_tenantId_code_key`(`tenantId`,`code`),
  INDEX `credit_note_reasons_tenantId_isActive_idx`(`tenantId`,`isActive`),
  INDEX `credit_note_reasons_defaultAdjustmentAccountId_idx`(`defaultAdjustmentAccountId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_credit_notes` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `financialYearId` VARCHAR(191) NULL,
  `creditNoteNumber` VARCHAR(64) NULL,
  `draftReference` VARCHAR(64) NULL,
  `status` ENUM('DRAFT','PENDING_APPROVAL','READY_TO_POST','POSTED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `purpose` ENUM('SALES_RETURN','PRICE_ADJUSTMENT','QUANTITY_ADJUSTMENT','QUALITY_CLAIM','DISCOUNT','FREIGHT_ADJUSTMENT','TAX_CORRECTION','COMMERCIAL_SETTLEMENT','OTHER') NOT NULL,
  `reasonId` VARCHAR(191) NULL,
  `reasonCodeSnapshot` VARCHAR(32) NULL,
  `reasonNameSnapshot` VARCHAR(200) NULL,
  `sourceType` ENUM('SALES_INVOICE','DIRECT') NOT NULL DEFAULT 'SALES_INVOICE',
  `originalInvoiceId` VARCHAR(191) NULL,
  `originalInvoiceNumberSnapshot` VARCHAR(64) NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `customerCodeSnapshot` VARCHAR(32) NULL,
  `customerNameSnapshot` VARCHAR(300) NOT NULL,
  `customerGstinSnapshot` VARCHAR(20) NULL,
  `customerPanSnapshot` VARCHAR(20) NULL,
  `customerStateCodeSnapshot` VARCHAR(8) NULL,
  `customerBillingAddressSnapshot` JSON NULL,
  `creditNoteDate` DATE NOT NULL,
  `postingDate` DATE NULL,
  `supplyType` ENUM('INTRA_STATE','INTER_STATE','EXPORT','SEZ','NON_GST') NOT NULL DEFAULT 'INTRA_STATE',
  `taxTreatment` ENUM('REGISTERED','UNREGISTERED','EXPORT_WITH_TAX','EXPORT_WITHOUT_TAX','SEZ_WITH_TAX','SEZ_WITHOUT_TAX','NON_GST') NOT NULL DEFAULT 'REGISTERED',
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `exchangeRate` DECIMAL(18,8) NOT NULL DEFAULT 1,
  `calculationContext` JSON NULL,
  `taxableAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `cgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `sgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `igstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `cessAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `totalTaxAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `freightAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `otherChargesAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `roundOffAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `grandTotal` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseTaxableAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseCgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseSgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseIgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseCessAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseTotalTaxAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseDiscountAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseFreightAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseOtherChargesAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseRoundOffAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `baseGrandTotal` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `inventoryReturnRequired` BOOLEAN NOT NULL DEFAULT false,
  `inventoryReturnMetadata` JSON NULL,
  `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
  `approvalRequestId` VARCHAR(191) NULL,
  `accountingVoucherId` VARCHAR(191) NULL,
  `postingEventId` VARCHAR(191) NULL,
  `creditOpenItemId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `cancellationReason` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `cust_cn_le_number_key`(`legalEntityId`,`creditNoteNumber`),
  UNIQUE INDEX `cust_cn_le_draft_ref_key`(`legalEntityId`,`draftReference`),
  UNIQUE INDEX `customer_credit_notes_approvalRequestId_key`(`approvalRequestId`),
  UNIQUE INDEX `customer_credit_notes_accountingVoucherId_key`(`accountingVoucherId`),
  UNIQUE INDEX `customer_credit_notes_postingEventId_key`(`postingEventId`),
  UNIQUE INDEX `customer_credit_notes_creditOpenItemId_key`(`creditOpenItemId`),
  INDEX `customer_credit_notes_tenantId_legalEntityId_idx`(`tenantId`,`legalEntityId`),
  INDEX `customer_credit_notes_legalEntityId_status_idx`(`legalEntityId`,`status`),
  INDEX `customer_credit_notes_legalEntityId_customerId_idx`(`legalEntityId`,`customerId`),
  INDEX `customer_credit_notes_originalInvoiceId_idx`(`originalInvoiceId`),
  INDEX `customer_credit_notes_creditNoteDate_idx`(`creditNoteDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_credit_note_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `customerCreditNoteId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `originalInvoiceLineId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NULL,
  `itemCodeSnapshot` VARCHAR(64) NULL,
  `itemNameSnapshot` VARCHAR(300) NULL,
  `hsnCodeSnapshot` VARCHAR(16) NULL,
  `uomSnapshot` VARCHAR(32) NULL,
  `description` VARCHAR(500) NULL,
  `adjustmentMode` ENUM('FULL_LINE','QUANTITY','VALUE','RATE','TAX_ONLY','FULL_INVOICE') NOT NULL,
  `quantity` DECIMAL(18,6) NOT NULL,
  `unitRate` DECIMAL(18,4) NOT NULL,
  `revisedUnitRate` DECIMAL(18,4) NULL,
  `grossAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `taxableAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `cgstRate` DECIMAL(9,4) NOT NULL DEFAULT 0,
  `cgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `sgstRate` DECIMAL(9,4) NOT NULL DEFAULT 0,
  `sgstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `igstRate` DECIMAL(9,4) NOT NULL DEFAULT 0,
  `igstAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `cessRate` DECIMAL(9,4) NOT NULL DEFAULT 0,
  `cessAmount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `lineTotal` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `revenueReversalAccountId` VARCHAR(191) NULL,
  `costCentreId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customer_credit_note_lines_customerCreditNoteId_lineNumber_key`(`customerCreditNoteId`,`lineNumber`),
  INDEX `customer_credit_note_lines_tenantId_legalEntityId_idx`(`tenantId`,`legalEntityId`),
  INDEX `customer_credit_note_lines_originalInvoiceLineId_idx`(`originalInvoiceLineId`),
  INDEX `customer_credit_note_lines_revenueReversalAccountId_idx`(`revenueReversalAccountId`),
  INDEX `customer_credit_note_lines_costCentreId_idx`(`costCentreId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `receivable_open_items`
  ADD COLUMN `customerCreditNoteId` VARCHAR(191) NULL AFTER `customerReceiptId`,
  ADD UNIQUE INDEX `receivable_open_items_customerCreditNoteId_key`(`customerCreditNoteId`),
  ADD INDEX `receivable_open_items_customerCreditNoteId_idx`(`customerCreditNoteId`);

ALTER TABLE `credit_note_reasons`
  ADD CONSTRAINT `credit_note_reasons_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `credit_note_reasons_defaultAdjustmentAccountId_fkey` FOREIGN KEY (`defaultAdjustmentAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customer_credit_notes`
  ADD CONSTRAINT `customer_credit_notes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_reasonId_fkey` FOREIGN KEY (`reasonId`) REFERENCES `credit_note_reasons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `finance_approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_notes_creditOpenItemId_fkey` FOREIGN KEY (`creditOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customer_credit_note_lines`
  ADD CONSTRAINT `customer_credit_note_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_note_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_note_lines_customerCreditNoteId_fkey` FOREIGN KEY (`customerCreditNoteId`) REFERENCES `customer_credit_notes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_note_lines_revenueReversalAccountId_fkey` FOREIGN KEY (`revenueReversalAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_credit_note_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `receivable_open_items`
  ADD CONSTRAINT `receivable_open_items_customerCreditNoteId_fkey` FOREIGN KEY (`customerCreditNoteId`) REFERENCES `customer_credit_notes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
