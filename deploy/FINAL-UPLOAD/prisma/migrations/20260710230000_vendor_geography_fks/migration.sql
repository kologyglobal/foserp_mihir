-- AlterTable
ALTER TABLE `master_vendors` ADD COLUMN `countryId` VARCHAR(191) NULL,
    ADD COLUMN `stateId` VARCHAR(191) NULL,
    ADD COLUMN `cityId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `master_vendors_tenantId_countryId_idx` ON `master_vendors`(`tenantId`, `countryId`);
CREATE INDEX `master_vendors_tenantId_stateId_idx` ON `master_vendors`(`tenantId`, `stateId`);
CREATE INDEX `master_vendors_tenantId_cityId_idx` ON `master_vendors`(`tenantId`, `cityId`);

-- AddForeignKey
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `master_countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `master_states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `master_cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
