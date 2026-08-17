-- Item Master: engineering/planning fields (drawing revision, part code, make, min/max stock,
-- lead time, shelf life, warranty) plus a default storage location paired with the existing
-- default bin ("Location with Bin No").

ALTER TABLE `master_items`
  ADD COLUMN `drawingRevision` VARCHAR(64) NULL,
  ADD COLUMN `partCodeNo` VARCHAR(64) NULL,
  ADD COLUMN `itemMake` VARCHAR(100) NULL,
  ADD COLUMN `minStockLevel` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `maxStockLevel` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `leadTimeDays` INT NOT NULL DEFAULT 0,
  ADD COLUMN `shelfLifeDays` INT NOT NULL DEFAULT 0,
  ADD COLUMN `warrantyPeriodMonths` INT NOT NULL DEFAULT 0,
  ADD COLUMN `defaultLocationId` VARCHAR(36) NULL;

CREATE INDEX `master_items_tenantId_defaultLocationId_idx` ON `master_items`(`tenantId`, `defaultLocationId`);

ALTER TABLE `master_items`
  ADD CONSTRAINT `master_items_defaultLocationId_fkey`
  FOREIGN KEY (`defaultLocationId`) REFERENCES `master_locations`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
