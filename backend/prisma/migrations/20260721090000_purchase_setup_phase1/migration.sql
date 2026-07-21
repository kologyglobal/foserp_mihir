-- Purchase Setup Phase 1: tenant settings + plant overrides + PO delivery warehouse

CREATE TABLE `purchase_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `defaultPlantId` VARCHAR(191) NULL,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `defaultReceivingLocationId` VARCHAR(191) NULL,
    `defaultQualityHoldLocationId` VARCHAR(191) NULL,
    `defaultRejectedLocationId` VARCHAR(191) NULL,
    `defaultVendorReturnLocationId` VARCHAR(191) NULL,
    `defaultCurrencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `defaultPaymentTermCode` VARCHAR(64) NULL,
    `defaultPaymentTermName` VARCHAR(200) NULL,
    `defaultBuyerId` VARCHAR(36) NULL,
    `defaultRfqRequired` BOOLEAN NOT NULL DEFAULT true,
    `allowDirectPo` BOOLEAN NOT NULL DEFAULT true,
    `requirePrBeforePo` BOOLEAN NOT NULL DEFAULT false,
    `requireRfqAboveAmount` DECIMAL(18, 2) NULL,
    `minimumRfqVendorCount` INTEGER NOT NULL DEFAULT 1,
    `requirePoWarehouse` BOOLEAN NOT NULL DEFAULT false,
    `requireExpectedDeliveryDate` BOOLEAN NOT NULL DEFAULT false,
    `requirePaymentTerms` BOOLEAN NOT NULL DEFAULT false,
    `allowOverReceipt` BOOLEAN NOT NULL DEFAULT false,
    `overReceiptTolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `requireVendorChallan` BOOLEAN NOT NULL DEFAULT false,
    `requireVehicleNumber` BOOLEAN NOT NULL DEFAULT false,
    `requireGateEntry` BOOLEAN NOT NULL DEFAULT false,
    `duplicateChallanPolicy` ENUM('BLOCK', 'WARN', 'ALLOW') NOT NULL DEFAULT 'BLOCK',
    `autoCreateQualityInspection` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_settings_tenantId_key`(`tenantId`),
    INDEX `purchase_settings_tenantId_idx`(`tenantId`),
    INDEX `purchase_settings_tenantId_defaultWarehouseId_idx`(`tenantId`, `defaultWarehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_plant_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `plantId` VARCHAR(191) NOT NULL,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `defaultReceivingLocationId` VARCHAR(191) NULL,
    `defaultQualityHoldLocationId` VARCHAR(191) NULL,
    `defaultRejectedLocationId` VARCHAR(191) NULL,
    `defaultVendorReturnLocationId` VARCHAR(191) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_plant_settings_tenantId_idx`(`tenantId`),
    INDEX `purchase_plant_settings_tenantId_plantId_idx`(`tenantId`, `plantId`),
    UNIQUE INDEX `purchase_plant_settings_tenantId_plantId_key`(`tenantId`, `plantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_orders`
    ADD COLUMN `deliveryWarehouseId` VARCHAR(191) NULL,
    ADD INDEX `purchase_orders_tenantId_deliveryWarehouseId_idx`(`tenantId`, `deliveryWarehouseId`);

ALTER TABLE `purchase_settings`
    ADD CONSTRAINT `purchase_settings_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultPlantId_fkey`
        FOREIGN KEY (`defaultPlantId`) REFERENCES `master_plants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultWarehouseId_fkey`
        FOREIGN KEY (`defaultWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultReceivingLocationId_fkey`
        FOREIGN KEY (`defaultReceivingLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultQualityHoldLocationId_fkey`
        FOREIGN KEY (`defaultQualityHoldLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultRejectedLocationId_fkey`
        FOREIGN KEY (`defaultRejectedLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_settings_defaultVendorReturnLocationId_fkey`
        FOREIGN KEY (`defaultVendorReturnLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_plant_settings`
    ADD CONSTRAINT `purchase_plant_settings_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_plantId_fkey`
        FOREIGN KEY (`plantId`) REFERENCES `master_plants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_defaultWarehouseId_fkey`
        FOREIGN KEY (`defaultWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_defaultReceivingLocationId_fkey`
        FOREIGN KEY (`defaultReceivingLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_defaultQualityHoldLocationId_fkey`
        FOREIGN KEY (`defaultQualityHoldLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_defaultRejectedLocationId_fkey`
        FOREIGN KEY (`defaultRejectedLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_plant_settings_defaultVendorReturnLocationId_fkey`
        FOREIGN KEY (`defaultVendorReturnLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_orders`
    ADD CONSTRAINT `purchase_orders_deliveryWarehouseId_fkey`
        FOREIGN KEY (`deliveryWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
