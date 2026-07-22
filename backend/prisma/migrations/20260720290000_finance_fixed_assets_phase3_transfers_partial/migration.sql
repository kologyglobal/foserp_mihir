-- Finance Fixed Assets Phase 3 — location transfers + partial disposal documents.

CREATE TABLE `fixed_asset_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `transferNumber` VARCHAR(64) NOT NULL,
    `transferDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `fromLocation` VARCHAR(200) NULL,
    `fromPlant` VARCHAR(200) NULL,
    `fromDepartment` VARCHAR(200) NULL,
    `fromCustodian` VARCHAR(200) NULL,
    `toLocation` VARCHAR(200) NULL,
    `toPlant` VARCHAR(200) NULL,
    `toDepartment` VARCHAR(200) NULL,
    `toCustodian` VARCHAR(200) NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_transfer_le_number_key` ON `fixed_asset_transfers`(`tenantId`, `legalEntityId`, `transferNumber`);
CREATE INDEX `fixed_asset_transfers_tenantId_idx` ON `fixed_asset_transfers`(`tenantId`);
CREATE INDEX `fa_transfer_le_status_idx` ON `fixed_asset_transfers`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_transfers_assetId_idx` ON `fixed_asset_transfers`(`assetId`);

ALTER TABLE `fixed_asset_transfers` ADD CONSTRAINT `fixed_asset_transfers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_transfers` ADD CONSTRAINT `fixed_asset_transfers_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_transfers` ADD CONSTRAINT `fixed_asset_transfers_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `fixed_asset_disposals` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `disposalNumber` VARCHAR(64) NOT NULL,
    `disposalType` ENUM('SALE', 'SCRAP', 'WRITE_OFF') NOT NULL,
    `disposalDate` DATE NOT NULL,
    `isPartial` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
    `disposedCost` DECIMAL(18, 4) NOT NULL,
    `disposedAccumDep` DECIMAL(18, 4) NOT NULL,
    `disposedNbv` DECIMAL(18, 4) NOT NULL,
    `proceeds` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `gainLoss` DECIMAL(18, 4) NOT NULL,
    `proceedsAccountId` VARCHAR(191) NULL,
    `buyerName` VARCHAR(200) NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_disposal_le_number_key` ON `fixed_asset_disposals`(`tenantId`, `legalEntityId`, `disposalNumber`);
CREATE UNIQUE INDEX `fixed_asset_disposals_postingEventId_key` ON `fixed_asset_disposals`(`postingEventId`);
CREATE INDEX `fixed_asset_disposals_tenantId_idx` ON `fixed_asset_disposals`(`tenantId`);
CREATE INDEX `fa_disposal_le_status_idx` ON `fixed_asset_disposals`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_disposals_assetId_idx` ON `fixed_asset_disposals`(`assetId`);

ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_postingEventId_fkey` FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
