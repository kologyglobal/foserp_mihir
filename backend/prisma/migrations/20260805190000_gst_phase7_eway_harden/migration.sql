-- Phase 7 — e-Way bill audit / transport mode / extension tracking

ALTER TABLE `gst_e_way_bills`
  ADD COLUMN `transportMode` VARCHAR(4) NULL,
  ADD COLUMN `idempotencyKey` VARCHAR(100) NULL,
  ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastAttemptAt` DATETIME(3) NULL,
  ADD COLUMN `extensionCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `vehicleUpdatedAt` DATETIME(3) NULL;

CREATE INDEX `gst_ewb_idem_idx` ON `gst_e_way_bills`(`tenantId`, `idempotencyKey`);
