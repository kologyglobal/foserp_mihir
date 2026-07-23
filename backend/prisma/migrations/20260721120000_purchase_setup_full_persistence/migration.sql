-- Purchase Setup full persistence: extend settings, approval matrix, inspection categories,
-- code-series entities, quality inspection / purchase invoice / purchase return tables.

-- Code series entity enum extensions
ALTER TABLE `code_series` MODIFY `entityType` ENUM(
  'USER',
  'LEAD',
  'CONTACT',
  'CRM_COMPANY',
  'OPPORTUNITY',
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_REQUISITION',
  'PURCHASE_PLANNING',
  'REQUEST_FOR_QUOTATION',
  'VENDOR_QUOTATION',
  'VENDOR_COMPARISON',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'QUALITY_INSPECTION',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN'
) NOT NULL;

-- Extend purchase_settings with full policy / tax / matching / print / quality scalars
ALTER TABLE `purchase_settings`
  ADD COLUMN `defaultDeliveryTerms` VARCHAR(200) NULL,
  ADD COLUMN `requireQuotationComparison` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `allowShortClose` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `requireBatch` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requireSerial` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requireExpiry` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `autoCompleteRef` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `allowAcceptanceUnderDeviation` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deviationApproverRole` ENUM('DEPARTMENT_HEAD', 'PURCHASE_HEAD', 'FINANCE_HEAD', 'MANAGEMENT') NULL,
  ADD COLUMN `allowRejectedStockInQuarantine` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `allowDirectInvoice` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requirePoMatch` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `requireGrnMatch` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `quantityTolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `rateTolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `amountToleranceInr` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `amountTolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `taxToleranceInr` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `taxTolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `allowAuthorizedOverride` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `defaultGstScheme` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN `placeOfSupplyState` VARCHAR(100) NULL,
  ADD COLUMN `placeOfSupplyStateCode` VARCHAR(8) NULL,
  ADD COLUMN `reverseChargeDefault` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tcsEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tdsEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `roundOffRule` ENUM('NONE', 'NEAREST_RUPEE', 'NEAREST_PAISA') NOT NULL DEFAULT 'NEAREST_RUPEE',
  ADD COLUMN `printCompanyName` VARCHAR(300) NULL,
  ADD COLUMN `printLogoUrl` VARCHAR(500) NULL,
  ADD COLUMN `showTermsOnPo` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `showTermsOnGrn` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `showTermsOnInvoice` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `printDefaultCopies` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `printPaperSize` ENUM('A4', 'LETTER') NOT NULL DEFAULT 'A4',
  ADD COLUMN `printOrientation` ENUM('PORTRAIT', 'LANDSCAPE') NOT NULL DEFAULT 'PORTRAIT';

CREATE TABLE `purchase_approval_tiers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseSettingsId` VARCHAR(191) NOT NULL,
    `minAmount` DECIMAL(18, 2) NOT NULL,
    `maxAmount` DECIMAL(18, 2) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `label` VARCHAR(200) NOT NULL,
    `documentType` ENUM('ALL', 'PURCHASE_REQUISITION', 'PURCHASE_ORDER') NOT NULL DEFAULT 'ALL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_approval_tiers_tenantId_idx`(`tenantId`),
    INDEX `purchase_approval_tiers_tenantId_purchaseSettingsId_idx`(`tenantId`, `purchaseSettingsId`),
    INDEX `purchase_approval_tiers_tenantId_sortOrder_idx`(`tenantId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_approval_tier_roles` (
    `id` VARCHAR(191) NOT NULL,
    `tierId` VARCHAR(191) NOT NULL,
    `role` ENUM('DEPARTMENT_HEAD', 'PURCHASE_HEAD', 'FINANCE_HEAD', 'MANAGEMENT') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 1,

    INDEX `purchase_approval_tier_roles_tierId_idx`(`tierId`),
    UNIQUE INDEX `purchase_approval_tier_roles_tierId_role_key`(`tierId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_inspection_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseSettingsId` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_inspection_categories_tenantId_idx`(`tenantId`),
    INDEX `purchase_inspection_categories_tenantId_purchaseSettingsId_idx`(`tenantId`, `purchaseSettingsId`),
    UNIQUE INDEX `purchase_inspection_categories_tenantId_categoryCode_key`(`tenantId`, `categoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- NOTE: Do not create quality_inspections / quality_inspection_lines here.
-- Manufacturing owns quality_inspections via 20260720200000_quality_phase4a_inspections.
-- Purchase GRN QC tables are created later by 20260722010000_purchase_quality_inspections_split
-- (purchase_quality_inspections / purchase_quality_inspection_lines).

CREATE TABLE `purchase_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(64) NOT NULL,
    `invoiceDate` DATE NOT NULL,
    `vendorInvoiceNumber` VARCHAR(100) NULL,
    `vendorInvoiceDate` DATE NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `goodsReceiptId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'MATCHED', 'PARTIALLY_MATCHED', 'MISMATCH', 'POSTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `isDirectInvoice` BOOLEAN NOT NULL DEFAULT false,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `gstScheme` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST',
    `placeOfSupplyState` VARCHAR(100) NULL,
    `placeOfSupplyStateCode` VARCHAR(8) NULL,
    `reverseCharge` BOOLEAN NOT NULL DEFAULT false,
    `subtotalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `roundOffAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `matchingStatus` VARCHAR(64) NULL,
    `matchingRemarks` TEXT NULL,
    `overrideAuthorized` BOOLEAN NOT NULL DEFAULT false,
    `overrideRemarks` TEXT NULL,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `postedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `purchase_invoices_tenantId_invoiceNumber_key`(`tenantId`, `invoiceNumber`),
    INDEX `purchase_invoices_tenantId_idx`(`tenantId`),
    INDEX `purchase_invoices_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_invoices_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `purchase_invoices_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `purchase_invoices_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_invoices_tenantId_goodsReceiptId_idx`(`tenantId`, `goodsReceiptId`),
    INDEX `purchase_invoices_tenantId_invoiceDate_idx`(`tenantId`, `invoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseInvoiceId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `purchaseOrderLineId` VARCHAR(191) NULL,
    `goodsReceiptLineId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxRatePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pi_lines_tenant_pi_lineno_key`(`tenantId`, `purchaseInvoiceId`, `lineNumber`),
    INDEX `purchase_invoice_lines_tenantId_idx`(`tenantId`),
    INDEX `pi_lines_tenant_pi_idx`(`tenantId`, `purchaseInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_returns` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `returnNumber` VARCHAR(64) NOT NULL,
    `returnDate` DATE NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `goodsReceiptId` VARCHAR(191) NULL,
    `qualityInspectionId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `warehouseId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `purchase_returns_tenantId_returnNumber_key`(`tenantId`, `returnNumber`),
    INDEX `purchase_returns_tenantId_idx`(`tenantId`),
    INDEX `purchase_returns_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_returns_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `purchase_returns_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `purchase_returns_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_returns_tenantId_goodsReceiptId_idx`(`tenantId`, `goodsReceiptId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_return_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseReturnId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `goodsReceiptLineId` VARCHAR(191) NULL,
    `purchaseOrderLineId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `returnQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prt_lines_tenant_prt_lineno_key`(`tenantId`, `purchaseReturnId`, `lineNumber`),
    INDEX `purchase_return_lines_tenantId_idx`(`tenantId`),
    INDEX `prt_lines_tenant_prt_idx`(`tenantId`, `purchaseReturnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_approval_tiers`
  ADD CONSTRAINT `purchase_approval_tiers_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_approval_tiers_purchaseSettingsId_fkey`
    FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `purchase_approval_tier_roles`
  ADD CONSTRAINT `purchase_approval_tier_roles_tierId_fkey`
    FOREIGN KEY (`tierId`) REFERENCES `purchase_approval_tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `purchase_inspection_categories`
  ADD CONSTRAINT `purchase_inspection_categories_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_inspection_categories_purchaseSettingsId_fkey`
    FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `purchase_invoices`
  ADD CONSTRAINT `purchase_invoices_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_invoice_lines`
  ADD CONSTRAINT `purchase_invoice_lines_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_invoice_lines_purchaseInvoiceId_fkey`
    FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `purchase_returns`
  ADD CONSTRAINT `purchase_returns_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_return_lines`
  ADD CONSTRAINT `purchase_return_lines_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_return_lines_purchaseReturnId_fkey`
    FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
