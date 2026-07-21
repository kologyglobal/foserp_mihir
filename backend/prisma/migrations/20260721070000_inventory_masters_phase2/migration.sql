-- Phase 2: Plant / Warehouse / Storage Location / Bin setup
-- Additive only — no data loss.

CREATE TABLE `master_plants` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_plants_tenantId_idx`(`tenantId`),
    INDEX `master_plants_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_plants_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_plants_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `master_bins` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `storageLocationId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `binType` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_bins_tenantId_idx`(`tenantId`),
    INDEX `master_bins_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `master_bins_tenantId_storageLocationId_idx`(`tenantId`, `storageLocationId`),
    INDEX `master_bins_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_bins_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_bins_tenantId_warehouseId_code_key`(`tenantId`, `warehouseId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `master_warehouses`
  ADD COLUMN `plantId` VARCHAR(191) NULL,
  ADD INDEX `master_warehouses_tenantId_plantId_idx`(`tenantId`, `plantId`);

ALTER TABLE `master_plants` ADD CONSTRAINT `master_plants_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_warehouses` ADD CONSTRAINT `master_warehouses_plantId_fkey` FOREIGN KEY (`plantId`) REFERENCES `master_plants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `master_bins` ADD CONSTRAINT `master_bins_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_bins` ADD CONSTRAINT `master_bins_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_bins` ADD CONSTRAINT `master_bins_storageLocationId_fkey` FOREIGN KEY (`storageLocationId`) REFERENCES `master_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
