-- Item Master: optional default bin from Bin Master (auto-fills PR/PO/GRN bin fields).

ALTER TABLE `master_items`
  ADD COLUMN `defaultBinId` VARCHAR(36) NULL;

CREATE INDEX `master_items_tenantId_defaultBinId_idx` ON `master_items`(`tenantId`, `defaultBinId`);

ALTER TABLE `master_items`
  ADD CONSTRAINT `master_items_defaultBinId_fkey`
  FOREIGN KEY (`defaultBinId`) REFERENCES `master_bins`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
