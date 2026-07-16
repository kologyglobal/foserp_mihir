-- AlterEnum
ALTER TABLE `code_series` MODIFY `entityType` ENUM('USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER') NOT NULL;

-- CreateTable
CREATE TABLE `crm_sales_orders` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `salesOrderNo` VARCHAR(64) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `qty` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `status` VARCHAR(32) NOT NULL DEFAULT 'open',
    `source` VARCHAR(32) NOT NULL DEFAULT 'quotation',
    `orderDate` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `requiredDate` DATE NULL,
    `expectedDeliveryDate` DATE NULL,
    `remarks` TEXT NULL,
    `quotationId` VARCHAR(191) NULL,
    `quotationNo` VARCHAR(64) NULL,
    `quotationRevisionNo` INTEGER NULL,
    `quotationDocumentId` VARCHAR(191) NULL,
    `quotationDocumentRevisionNo` INTEGER NULL,
    `opportunityId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(18, 2) NULL,
    `discountPct` DECIMAL(5, 2) NULL,
    `grandTotal` DECIMAL(18, 2) NULL,
    `basicAmount` DECIMAL(18, 2) NULL,
    `gstAmount` DECIMAL(18, 2) NULL,
    `paymentTerms` VARCHAR(500) NULL,
    `deliveryTerms` VARCHAR(500) NULL,
    `warrantyTerms` VARCHAR(500) NULL,
    `commercialNotes` TEXT NULL,
    `technicalNotes` TEXT NULL,
    `customerCode` VARCHAR(64) NULL,
    `customerPoNumber` VARCHAR(100) NULL,
    `customerPoDate` DATE NULL,
    `deliveryLocation` VARCHAR(500) NULL,
    `billingAddress` TEXT NULL,
    `shippingAddress` TEXT NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `internalRemarks` TEXT NULL,
    `locationId` VARCHAR(191) NULL,
    `lines` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_sales_orders_tenantId_idx`(`tenantId`),
    INDEX `crm_sales_orders_tenantId_companyId_idx`(`tenantId`, `companyId`),
    INDEX `crm_sales_orders_tenantId_quotationId_idx`(`tenantId`, `quotationId`),
    INDEX `crm_sales_orders_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    INDEX `crm_sales_orders_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_sales_orders_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_sales_orders_tenantId_salesOrderNo_key`(`tenantId`, `salesOrderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crm_sales_orders` ADD CONSTRAINT `crm_sales_orders_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_sales_orders` ADD CONSTRAINT `crm_sales_orders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
