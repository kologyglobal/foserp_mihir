-- DropForeignKey
ALTER TABLE `master_item_categories` DROP FOREIGN KEY `master_item_categories_defaultWarehouseId_fkey`;

-- DropForeignKey
ALTER TABLE `master_item_categories` DROP FOREIGN KEY `master_item_categories_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `master_items` DROP FOREIGN KEY `master_items_gstGroupId_fkey`;

-- DropForeignKey
ALTER TABLE `master_items` DROP FOREIGN KEY `master_items_hsnId_fkey`;

-- DropForeignKey
ALTER TABLE `master_items` DROP FOREIGN KEY `master_items_purchaseUomId_fkey`;

-- DropIndex
DROP INDEX `master_item_categories_defaultWarehouseId_fkey` ON `master_item_categories`;

-- DropIndex
DROP INDEX `master_item_categories_parentId_fkey` ON `master_item_categories`;

-- DropIndex
DROP INDEX `master_items_gstGroupId_fkey` ON `master_items`;

-- DropIndex
DROP INDEX `master_items_hsnId_fkey` ON `master_items`;

-- DropIndex
DROP INDEX `master_items_purchaseUomId_fkey` ON `master_items`;

-- AlterTable
ALTER TABLE `master_items` MODIFY `itemDescription` TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `crm_quotations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `quotationCode` VARCHAR(32) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `validityDate` DATE NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_quotations_tenantId_idx`(`tenantId`),
    INDEX `crm_quotations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_quotations_tenantId_companyId_idx`(`tenantId`, `companyId`),
    INDEX `crm_quotations_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    INDEX `crm_quotations_tenantId_salesOwnerId_idx`(`tenantId`, `salesOwnerId`),
    UNIQUE INDEX `crm_quotations_tenantId_quotationCode_key`(`tenantId`, `quotationCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_quotation_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `revisionNo` INTEGER NOT NULL DEFAULT 1,
    `templateId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `revisionReason` TEXT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `approvalHistory` JSON NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdByName` VARCHAR(200) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_quotation_documents_tenantId_idx`(`tenantId`),
    INDEX `crm_quotation_documents_tenantId_quotationId_idx`(`tenantId`, `quotationId`),
    INDEX `crm_quotation_documents_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_quotation_documents_tenantId_salesOwnerId_idx`(`tenantId`, `salesOwnerId`),
    INDEX `crm_quotation_documents_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_quotation_documents_tenantId_quotationId_revisionNo_key`(`tenantId`, `quotationId`, `revisionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `crm_opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotation_documents` ADD CONSTRAINT `crm_quotation_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotation_documents` ADD CONSTRAINT `crm_quotation_documents_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `crm_quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `master_item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_defaultWarehouseId_fkey` FOREIGN KEY (`defaultWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_purchaseUomId_fkey` FOREIGN KEY (`purchaseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_hsnId_fkey` FOREIGN KEY (`hsnId`) REFERENCES `master_hsn_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
