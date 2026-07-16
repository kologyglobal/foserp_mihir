-- Quotation document templates (CRM-P0-3)

CREATE TABLE `crm_quotation_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `templateName` VARCHAR(200) NOT NULL,
    `productFamily` VARCHAR(100) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `sections` JSON NOT NULL,
    `defaultTerms` TEXT NOT NULL,
    `defaultWarranty` TEXT NOT NULL,
    `defaultExclusions` TEXT NOT NULL,
    `printLayout` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `crm_quotation_templates_tenantId_code_key`(`tenantId`, `code`),
    INDEX `crm_quotation_templates_tenantId_idx`(`tenantId`),
    INDEX `crm_quotation_templates_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_quotation_templates_tenantId_isActive_idx`(`tenantId`, `isActive`),
    INDEX `crm_quotation_templates_tenantId_productFamily_idx`(`tenantId`, `productFamily`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `crm_quotation_templates` ADD CONSTRAINT `crm_quotation_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
