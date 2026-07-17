-- Finance Phase 2B — Central posting engine (number reservation on posting events)

ALTER TABLE `posting_events`
  ADD COLUMN `numberSeriesId` VARCHAR(191) NULL,
  ADD COLUMN `reservedVoucherNumber` VARCHAR(64) NULL,
  ADD COLUMN `numberReservedAt` DATETIME(3) NULL;

CREATE INDEX `posting_events_numberSeriesId_idx` ON `posting_events`(`numberSeriesId`);
