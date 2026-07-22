-- Finance Fixed Assets Phase 2 — simple full disposal fields on fixed_assets.

ALTER TABLE `fixed_assets`
  ADD COLUMN `disposalType` ENUM('SALE', 'SCRAP', 'WRITE_OFF') NULL,
  ADD COLUMN `disposalDate` DATE NULL,
  ADD COLUMN `disposalProceeds` DECIMAL(18, 4) NULL,
  ADD COLUMN `disposalGainLoss` DECIMAL(18, 4) NULL,
  ADD COLUMN `disposalProceedsAccountId` VARCHAR(191) NULL,
  ADD COLUMN `disposalBuyerName` VARCHAR(200) NULL,
  ADD COLUMN `disposalReason` VARCHAR(1000) NULL,
  ADD COLUMN `disposalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `disposalPostingEventId` VARCHAR(191) NULL,
  ADD COLUMN `disposedAt` DATETIME(3) NULL,
  ADD COLUMN `disposedById` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `fixed_assets_disposalPostingEventId_key` ON `fixed_assets`(`disposalPostingEventId`);

ALTER TABLE `fixed_assets`
  ADD CONSTRAINT `fixed_assets_disposalPostingEventId_fkey`
  FOREIGN KEY (`disposalPostingEventId`) REFERENCES `posting_events`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
