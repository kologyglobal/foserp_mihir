-- Accounts Payable vendor dispute register (no GL posting).

CREATE TABLE `ap_disputes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `disputeNumber` VARCHAR(64) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorCodeSnapshot` VARCHAR(32) NOT NULL,
    `vendorNameSnapshot` VARCHAR(300) NOT NULL,
    `vendorInvoiceId` VARCHAR(191) NOT NULL,
    `payableOpenItemId` VARCHAR(191) NULL,
    `vendorInvoiceNumberSnapshot` VARCHAR(64) NOT NULL,
    `supplierInvoiceNumberSnapshot` VARCHAR(128) NOT NULL,
    `disputeDate` DATE NOT NULL,
    `disputeType` ENUM('PRICE_DIFFERENCE', 'QUANTITY_DIFFERENCE', 'QUALITY_ISSUE', 'DELIVERY_DELAY', 'SHORT_SUPPLY', 'TAX_ISSUE', 'MISSING_DOCUMENT', 'DUPLICATE_INVOICE', 'COMMERCIAL_TERMS', 'OTHER') NOT NULL,
    `disputedAmount` DECIMAL(18, 4) NOT NULL,
    `description` TEXT NOT NULL,
    `ownerName` VARCHAR(200) NOT NULL,
    `responsibleDepartment` VARCHAR(120) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `targetResolutionDate` DATE NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'AWAITING_VENDOR', 'AWAITING_INTERNAL_TEAM', 'RESOLVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `debitNoteRequired` BOOLEAN NOT NULL DEFAULT false,
    `paymentHold` BOOLEAN NOT NULL DEFAULT false,
    `supportingDocuments` JSON NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ap_dispute_le_number_key`(`tenantId`, `legalEntityId`, `disputeNumber`),
    INDEX `ap_disputes_tenantId_idx`(`tenantId`),
    INDEX `ap_disputes_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `ap_disputes_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `ap_disputes_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `ap_disputes_tenantId_vendorInvoiceId_idx`(`tenantId`, `vendorInvoiceId`),
    INDEX `ap_disputes_tenantId_payableOpenItemId_idx`(`tenantId`, `payableOpenItemId`),
    INDEX `ap_disputes_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ap_disputes` ADD CONSTRAINT `ap_disputes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ap_disputes` ADD CONSTRAINT `ap_disputes_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ap_disputes` ADD CONSTRAINT `ap_disputes_vendorInvoiceId_fkey` FOREIGN KEY (`vendorInvoiceId`) REFERENCES `vendor_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ap_disputes` ADD CONSTRAINT `ap_disputes_payableOpenItemId_fkey` FOREIGN KEY (`payableOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
