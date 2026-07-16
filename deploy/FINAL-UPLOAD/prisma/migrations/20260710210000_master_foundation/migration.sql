-- CreateEnum
-- MasterRecordStatus handled as ENUM in Prisma

-- CreateTable
CREATE TABLE `master_countries` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_countries_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_countries_tenantId_idx`(`tenantId`),
    INDEX `master_countries_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_countries_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_states` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_states_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_states_tenantId_idx`(`tenantId`),
    INDEX `master_states_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_states_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_cities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `stateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_cities_tenantId_stateId_name_key`(`tenantId`, `stateId`, `name`),
    INDEX `master_cities_tenantId_idx`(`tenantId`),
    INDEX `master_cities_tenantId_stateId_idx`(`tenantId`, `stateId`),
    INDEX `master_cities_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_cities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_uoms` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `uomType` VARCHAR(32) NOT NULL DEFAULT 'integer',
    `decimalPlaces` INTEGER NOT NULL DEFAULT 0,
    `isBaseUnit` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_uoms_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_uoms_tenantId_idx`(`tenantId`),
    INDEX `master_uoms_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_uoms_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_warehouses` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `warehouseType` VARCHAR(32) NOT NULL DEFAULT 'main',
    `plantCode` VARCHAR(32) NOT NULL DEFAULT 'PUNE',
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_warehouses_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_warehouses_tenantId_idx`(`tenantId`),
    INDEX `master_warehouses_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_warehouses_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_locations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `addressLine1` VARCHAR(300) NULL,
    `addressLine2` VARCHAR(300) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(16) NULL,
    `country` VARCHAR(100) NULL,
    `gstin` VARCHAR(15) NULL,
    `registeredType` VARCHAR(64) NULL,
    `allowSales` BOOLEAN NOT NULL DEFAULT true,
    `allowPurchase` BOOLEAN NOT NULL DEFAULT true,
    `allowProduction` BOOLEAN NOT NULL DEFAULT true,
    `allowInventory` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `master_locations_tenantId_code_key`(`tenantId`, `code`),
    INDEX `master_locations_tenantId_idx`(`tenantId`),
    INDEX `master_locations_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `master_locations_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_locations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `master_countries` ADD CONSTRAINT `master_countries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_states` ADD CONSTRAINT `master_states_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_cities` ADD CONSTRAINT `master_cities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_uoms` ADD CONSTRAINT `master_uoms_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_warehouses` ADD CONSTRAINT `master_warehouses_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_locations` ADD CONSTRAINT `master_locations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `master_locations` ADD CONSTRAINT `master_locations_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
