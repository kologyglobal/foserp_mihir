-- CreateTable
CREATE TABLE `master_products` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `productFamily` VARCHAR(64) NOT NULL DEFAULT 'bulker_trailer',
    `productType` VARCHAR(32) NOT NULL DEFAULT 'bulker',
    `fgItemId` VARCHAR(64) NULL,
    `capacity` VARCHAR(100) NOT NULL DEFAULT '',
    `axleConfig` VARCHAR(100) NOT NULL DEFAULT '',
    `tareWeightKg` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gvwKg` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `standardPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `standardLeadDays` INTEGER NOT NULL DEFAULT 0,
    `baseUomId` VARCHAR(64) NULL,
    `hsnCode` VARCHAR(16) NOT NULL DEFAULT '',
    `specifications` TEXT NOT NULL,
    `productStatus` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `details` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_products_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_products_tenantId_idx`(`tenantId`),
    INDEX `master_products_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_products_tenantId_productStatus_idx`(`tenantId`, `productStatus`),
    INDEX `master_products_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `master_products` ADD CONSTRAINT `master_products_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
