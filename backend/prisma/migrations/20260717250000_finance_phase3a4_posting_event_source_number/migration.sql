-- Phase 3A4: reserve source document numbers (e.g. SALES_INVOICE) on posting events
ALTER TABLE `posting_events`
  ADD COLUMN `sourceNumberSeriesId` VARCHAR(191) NULL,
  ADD COLUMN `reservedSourceDocumentNumber` VARCHAR(64) NULL,
  ADD COLUMN `sourceNumberReservedAt` DATETIME(3) NULL;

CREATE INDEX `posting_events_sourceNumberSeriesId_idx` ON `posting_events`(`sourceNumberSeriesId`);
