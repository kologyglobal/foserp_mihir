-- Finance Phase 4C2 — Vendor adjustment (debit note / credit adjustment) database foundation
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
    'VENDOR_PAYMENT',
    'VENDOR_DEBIT_NOTE',
    'VENDOR_CREDIT_ADJUSTMENT'
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
    'VENDOR_ADJUSTMENT'
  ) NOT NULL;

-- CreateTable vendor_adjustments
CREATE TABLE `vendor_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `draftReference` VARCHAR(64) NOT NULL,
    `vendorAdjustmentNumber` VARCHAR(64) NULL,
    `adjustmentType` ENUM('VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `reason` ENUM('PURCHASE_RETURN', 'RATE_DIFFERENCE', 'SHORT_SUPPLY', 'QUALITY_CLAIM', 'DAMAGE_CLAIM', 'COMMERCIAL_DISCOUNT', 'FREIGHT_RECOVERY', 'TAX_CORRECTION', 'TDS_CORRECTION', 'ROUND_OFF', 'OPENING_CORRECTION', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `taxEffect` ENUM('NONE', 'ADD_RECOVERABLE_INPUT_TAX', 'REVERSE_RECOVERABLE_INPUT_TAX', 'NON_RECOVERABLE_TAX', 'MIXED') NOT NULL DEFAULT 'NONE',
    `itcTreatment` ENUM('NO_ITC_CHANGE', 'FULL_ITC_ADDITION', 'PARTIAL_ITC_ADDITION', 'FULL_ITC_REVERSAL', 'PARTIAL_ITC_REVERSAL', 'NON_RECOVERABLE', 'PENDING_REVIEW') NOT NULL DEFAULT 'NO_ITC_CHANGE',
    `tdsTreatment` ENUM('NO_TDS_CHANGE', 'ADD_TDS_LIABILITY', 'REVERSE_TDS_LIABILITY') NOT NULL DEFAULT 'NO_TDS_CHANGE',
    `supplierReferenceNumber` VARCHAR(128) NOT NULL,
    `supplierReferenceNumberNormalized` VARCHAR(128) NOT NULL,
    `supplierReferenceUniquenessKey` VARCHAR(512) NULL,
    `supplierReferenceDate` DATE NOT NULL,
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
    `adjustmentGrandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
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
    `baseAdjustmentGrandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsBaseAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTdsAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseVendorPayableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vendorPayableAccountId` VARCHAR(191) NULL,
    `offsetAccountId` VARCHAR(191) NULL,
    `inputCgstAccountId` VARCHAR(191) NULL,
    `inputSgstAccountId` VARCHAR(191) NULL,
    `inputIgstAccountId` VARCHAR(191) NULL,
    `inputCessAccountId` VARCHAR(191) NULL,
    `otherRecoverableTaxAccountId` VARCHAR(191) NULL,
    `nonRecoverableTaxAccountId` VARCHAR(191) NULL,
    `tdsPayableAccountId` VARCHAR(191) NULL,
    `roundOffAccountId` VARCHAR(191) NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `calculationContext` JSON NULL,
    `calculationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
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
    `reversalDate` DATE NULL,
    `reversalReason` VARCHAR(500) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,
    `reversalPostingEventId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_adj_tenant_draft_ref_key`(`tenantId`, `draftReference`),
    UNIQUE INDEX `vend_adj_tenant_le_number_key`(`tenantId`, `legalEntityId`, `vendorAdjustmentNumber`),
    UNIQUE INDEX `vendor_adjustments_supplierReferenceUniquenessKey_key`(`supplierReferenceUniquenessKey`),
    UNIQUE INDEX `vendor_adjustments_approvalRequestId_key`(`approvalRequestId`),
    UNIQUE INDEX `vendor_adjustments_accountingVoucherId_key`(`accountingVoucherId`),
    UNIQUE INDEX `vendor_adjustments_postingEventId_key`(`postingEventId`),
    UNIQUE INDEX `vendor_adjustments_payableOpenItemId_key`(`payableOpenItemId`),
    UNIQUE INDEX `vendor_adjustments_reversalVoucherId_key`(`reversalVoucherId`),
    UNIQUE INDEX `vendor_adjustments_reversalPostingEventId_key`(`reversalPostingEventId`),
    INDEX `vendor_adjustments_tenantId_idx`(`tenantId`),
    INDEX `vendor_adjustments_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `vendor_adjustments_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `vendor_adjustments_tenantId_legalEntityId_vendorId_idx`(`tenantId`, `legalEntityId`, `vendorId`),
    INDEX `vendor_adjustments_tenantId_legalEntityId_adjustmentType_idx`(`tenantId`, `legalEntityId`, `adjustmentType`),
    INDEX `vend_adj_supplier_date_idx`(`tenantId`, `legalEntityId`, `supplierReferenceDate`),
    INDEX `vendor_adjustments_tenantId_legalEntityId_financialYearId_idx`(`tenantId`, `legalEntityId`, `financialYearId`),
    INDEX `vend_adj_supplier_ref_idx`(`tenantId`, `legalEntityId`, `vendorId`, `supplierReferenceNumberNormalized`),
    INDEX `vendor_adjustments_financialYearId_idx`(`financialYearId`),
    INDEX `vendor_adjustments_branchId_idx`(`branchId`),
    INDEX `vendor_adjustments_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable vendor_adjustment_lines
CREATE TABLE `vendor_adjustment_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `vendorAdjustmentId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `lineType` ENUM('ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE', 'TAX_CORRECTION', 'OTHER') NOT NULL,
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
    `offsetAccountId` VARCHAR(191) NULL,
    `costCentreId` VARCHAR(191) NULL,
    `projectReference` VARCHAR(64) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `sourceLinkType` ENUM('VENDOR_INVOICE', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_RECEIPT', 'CONTRACT', 'PROJECT', 'OTHER') NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentNumber` VARCHAR(64) NULL,
    `sourceDocumentLineId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vend_adj_line_num_key`(`vendorAdjustmentId`, `lineNumber`),
    INDEX `vendor_adjustment_lines_tenantId_idx`(`tenantId`),
    INDEX `vendor_adjustment_lines_legalEntityId_idx`(`legalEntityId`),
    INDEX `vendor_adjustment_lines_vendorAdjustmentId_idx`(`vendorAdjustmentId`),
    INDEX `vendor_adjustment_lines_itemId_idx`(`itemId`),
    INDEX `vendor_adjustment_lines_offsetAccountId_idx`(`offsetAccountId`),
    INDEX `vendor_adjustment_lines_costCentreId_idx`(`costCentreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable vendor_adjustment_source_links
CREATE TABLE `vendor_adjustment_source_links` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `vendorAdjustmentId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('VENDOR_INVOICE', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_RECEIPT', 'CONTRACT', 'PROJECT', 'OTHER') NOT NULL,
    `sourceDocumentId` VARCHAR(191) NOT NULL,
    `sourceDocumentNumberSnapshot` VARCHAR(64) NULL,
    `sourceDocumentDateSnapshot` DATE NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vend_adj_src_link_key`(`vendorAdjustmentId`, `sourceType`, `sourceDocumentId`),
    INDEX `vendor_adjustment_source_links_tenantId_idx`(`tenantId`),
    INDEX `vendor_adjustment_source_links_legalEntityId_idx`(`legalEntityId`),
    INDEX `vendor_adjustment_source_links_vendorAdjustmentId_idx`(`vendorAdjustmentId`),
    INDEX `vend_adj_src_doc_idx`(`sourceType`, `sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable payable_open_items — source link for vendor adjustment DEBIT/CREDIT open items
ALTER TABLE `payable_open_items` ADD COLUMN `sourceVendorAdjustmentId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `payable_open_items_sourceVendorAdjustmentId_key` ON `payable_open_items`(`sourceVendorAdjustmentId`);

-- AddForeignKey vendor_adjustments
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_reversalVoucherId_fkey` FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_reversalPostingEventId_fkey` FOREIGN KEY (`reversalPostingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `finance_approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_payableOpenItemId_fkey` FOREIGN KEY (`payableOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_vendorPayableAccountId_fkey` FOREIGN KEY (`vendorPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_offsetAccountId_fkey` FOREIGN KEY (`offsetAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_inputCgstAccountId_fkey` FOREIGN KEY (`inputCgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_inputSgstAccountId_fkey` FOREIGN KEY (`inputSgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_inputIgstAccountId_fkey` FOREIGN KEY (`inputIgstAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_inputCessAccountId_fkey` FOREIGN KEY (`inputCessAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_otherRecoverableTaxAccountId_fkey` FOREIGN KEY (`otherRecoverableTaxAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_nonRecoverableTaxAccountId_fkey` FOREIGN KEY (`nonRecoverableTaxAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_tdsPayableAccountId_fkey` FOREIGN KEY (`tdsPayableAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustments` ADD CONSTRAINT `vendor_adjustments_roundOffAccountId_fkey` FOREIGN KEY (`roundOffAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey vendor_adjustment_lines
ALTER TABLE `vendor_adjustment_lines` ADD CONSTRAINT `vendor_adjustment_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_lines` ADD CONSTRAINT `vendor_adjustment_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_lines` ADD CONSTRAINT `vendor_adjustment_lines_vendorAdjustmentId_fkey` FOREIGN KEY (`vendorAdjustmentId`) REFERENCES `vendor_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_lines` ADD CONSTRAINT `vendor_adjustment_lines_offsetAccountId_fkey` FOREIGN KEY (`offsetAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_lines` ADD CONSTRAINT `vendor_adjustment_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey vendor_adjustment_source_links
ALTER TABLE `vendor_adjustment_source_links` ADD CONSTRAINT `vendor_adjustment_source_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_source_links` ADD CONSTRAINT `vendor_adjustment_source_links_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vendor_adjustment_source_links` ADD CONSTRAINT `vendor_adjustment_source_links_vendorAdjustmentId_fkey` FOREIGN KEY (`vendorAdjustmentId`) REFERENCES `vendor_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey payable_open_items.sourceVendorAdjustmentId
ALTER TABLE `payable_open_items` ADD CONSTRAINT `payable_open_items_sourceVendorAdjustmentId_fkey` FOREIGN KEY (`sourceVendorAdjustmentId`) REFERENCES `vendor_adjustments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
