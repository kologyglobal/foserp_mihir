-- Phase 6 — e-Invoice audit / idempotency / attempt tracking

ALTER TABLE `gst_e_invoices`
  ADD COLUMN `idempotencyKey` VARCHAR(100) NULL,
  ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastAttemptAt` DATETIME(3) NULL,
  ADD COLUMN `lastRequestJson` JSON NULL,
  ADD COLUMN `lastResponseJson` JSON NULL;

CREATE INDEX `gst_einv_idem_idx` ON `gst_e_invoices`(`tenantId`, `idempotencyKey`);
