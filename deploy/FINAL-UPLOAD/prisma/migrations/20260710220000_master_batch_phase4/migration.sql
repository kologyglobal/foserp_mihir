CREATE TABLE `master_item_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_item_categories_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_item_categories_tenantId_idx`(`tenantId`),
    INDEX `master_item_categories_tenantId_parentId_idx`(`tenantId`, `parentId`),
    INDEX `master_item_categories_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_item_categories_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_gst_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `goodsType` VARCHAR(16) NOT NULL DEFAULT 'goods',
    `description` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_gst_groups_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_gst_groups_tenantId_idx`(`tenantId`),
    INDEX `master_gst_groups_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_gst_groups_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_hsn_codes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `gstGroupId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_hsn_codes_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_hsn_codes_tenantId_idx`(`tenantId`),
    INDEX `master_hsn_codes_tenantId_gstGroupId_idx`(`tenantId`, `gstGroupId`),
    INDEX `master_hsn_codes_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_hsn_codes_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_gst_rates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `gstGroupId` VARCHAR(191) NOT NULL,
    `fromState` VARCHAR(100) NOT NULL,
    `locationStateCode` VARCHAR(100) NOT NULL,
    `dateFrom` DATE NOT NULL,
    `dateTo` DATE NULL,
    `sgst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `cgst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `igst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_gst_rates_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_gst_rates_tenantId_idx`(`tenantId`),
    INDEX `master_gst_rates_tenantId_gstGroupId_idx`(`tenantId`, `gstGroupId`),
    INDEX `master_gst_rates_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_gst_rates_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `itemName2` VARCHAR(300) NULL,
    `itemDescription` TEXT NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `baseUomId` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(32) NOT NULL,
    `productType` VARCHAR(32) NULL,
    `inventoryType` VARCHAR(32) NULL DEFAULT 'inventory',
    `codeSeriesMode` VARCHAR(16) NULL DEFAULT 'manual',
    `materialGrade` VARCHAR(100) NOT NULL DEFAULT '',
    `hsnCode` VARCHAR(16) NOT NULL DEFAULT '',
    `hsnId` VARCHAR(191) NULL,
    `gstGroupId` VARCHAR(191) NULL,
    `reorderLevel` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reorderQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `standardRate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `isPurchasable` BOOLEAN NOT NULL DEFAULT true,
    `isStockable` BOOLEAN NOT NULL DEFAULT true,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `quantityPerUom` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `purchaseUomId` VARCHAR(191) NULL,
    `purchaseQtyPerUom` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `qcRequired` BOOLEAN NOT NULL DEFAULT false,
    `qualityTestGroupCode` VARCHAR(32) NULL,
    `productionBomId` VARCHAR(36) NULL,
    `routingNo` VARCHAR(64) NULL,
    `drawingNo` VARCHAR(64) NULL,
    `subAssemblyRule` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_items_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_items_tenantId_idx`(`tenantId`),
    INDEX `master_items_tenantId_categoryId_idx`(`tenantId`, `categoryId`),
    INDEX `master_items_tenantId_itemType_idx`(`tenantId`, `itemType`),
    INDEX `master_items_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_items_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_vendors` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `searchName` VARCHAR(50) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `address` TEXT NULL,
    `address2` VARCHAR(500) NULL,
    `city` VARCHAR(100) NOT NULL DEFAULT '',
    `state` VARCHAR(100) NOT NULL DEFAULT '',
    `pincode` VARCHAR(20) NULL,
    `country` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `gstin` VARCHAR(20) NOT NULL DEFAULT '',
    `gstVendorType` VARCHAR(32) NULL DEFAULT 'registered',
    `pan` VARCHAR(10) NULL,
    `panStatus` VARCHAR(32) NULL DEFAULT 'pan_applied',
    `paymentMethod` VARCHAR(64) NULL,
    `bankDetails` TEXT NULL,
    `vendorType` VARCHAR(32) NOT NULL DEFAULT 'manufacturer',
    `contactPerson` VARCHAR(200) NOT NULL DEFAULT '',
    `contactPhone` VARCHAR(30) NOT NULL DEFAULT '',
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 30,
    `defaultLeadTimeDays` INTEGER NOT NULL DEFAULT 7,
    `suppliedCategories` JSON NOT NULL,
    `rating` DECIMAL(3, 1) NOT NULL DEFAULT 4,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_vendors_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_vendors_tenantId_idx`(`tenantId`),
    INDEX `master_vendors_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_vendors_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `master_item_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_defaultWarehouseId_fkey` FOREIGN KEY (`defaultWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_gst_groups` ADD CONSTRAINT `master_gst_groups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_hsn_codes` ADD CONSTRAINT `master_hsn_codes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_hsn_codes` ADD CONSTRAINT `master_hsn_codes_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_gst_rates` ADD CONSTRAINT `master_gst_rates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_gst_rates` ADD CONSTRAINT `master_gst_rates_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_items` ADD CONSTRAINT `master_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `master_item_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_baseUomId_fkey` FOREIGN KEY (`baseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_purchaseUomId_fkey` FOREIGN KEY (`purchaseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_hsnId_fkey` FOREIGN KEY (`hsnId`) REFERENCES `master_hsn_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
