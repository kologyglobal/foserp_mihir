-- Phase 8C Wave 5 — AR dispute register (no GL posting)

CREATE TABLE `ar_disputes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `disputeNumber` VARCHAR(64) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `customerNameSnapshot` VARCHAR(300) NOT NULL,
    `salesInvoiceId` VARCHAR(191) NOT NULL,
    `openItemId` VARCHAR(191) NULL,
    `invoiceNumberSnapshot` VARCHAR(64) NOT NULL,
    `disputeDate` DATE NOT NULL,
    `disputeType` ENUM('PRICE_DIFFERENCE', 'QUANTITY_DIFFERENCE', 'QUALITY_ISSUE', 'DELIVERY_DELAY', 'SHORT_SUPPLY', 'TAX_ISSUE', 'MISSING_DOCUMENT', 'DUPLICATE_INVOICE', 'COMMERCIAL_TERMS', 'OTHER') NOT NULL,
    `disputedAmount` DECIMAL(18, 4) NOT NULL,
    `description` TEXT NOT NULL,
    `ownerName` VARCHAR(200) NOT NULL,
    `responsibleDepartment` VARCHAR(120) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `targetResolutionDate` DATE NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_INTERNAL_TEAM', 'RESOLVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `creditNoteRequired` BOOLEAN NOT NULL DEFAULT false,
    `collectionHold` BOOLEAN NOT NULL DEFAULT false,
    `supportingDocuments` JSON NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ar_dispute_le_number_key`(`tenantId`, `legalEntityId`, `disputeNumber`),
    INDEX `ar_disputes_tenantId_idx`(`tenantId`),
    INDEX `ar_disputes_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `ar_disputes_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `ar_disputes_tenantId_customerId_idx`(`tenantId`, `customerId`),
    INDEX `ar_disputes_tenantId_salesInvoiceId_idx`(`tenantId`, `salesInvoiceId`),
    INDEX `ar_disputes_tenantId_openItemId_idx`(`tenantId`, `openItemId`),
    INDEX `ar_disputes_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ar_disputes` ADD CONSTRAINT `ar_disputes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ar_disputes` ADD CONSTRAINT `ar_disputes_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ar_disputes` ADD CONSTRAINT `ar_disputes_salesInvoiceId_fkey` FOREIGN KEY (`salesInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ar_disputes` ADD CONSTRAINT `ar_disputes_openItemId_fkey` FOREIGN KEY (`openItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
