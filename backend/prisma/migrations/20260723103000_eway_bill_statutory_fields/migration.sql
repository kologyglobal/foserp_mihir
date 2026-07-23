-- e-Way Bill statutory register enrichment (API-driven; not a manual number field)
ALTER TABLE `gst_e_way_bills`
  ADD COLUMN `outboundDispatchId` VARCHAR(191) NULL,
  ADD COLUMN `transporterId` VARCHAR(20) NULL,
  ADD COLUMN `generatedAt` DATETIME(3) NULL,
  ADD COLUMN `requiredReason` VARCHAR(500) NULL,
  ADD COLUMN `movementReason` VARCHAR(200) NULL,
  ADD COLUMN `lastRequestJson` JSON NULL,
  ADD COLUMN `lastResponseJson` JSON NULL;

CREATE INDEX `gst_ewb_tenant_ob_idx` ON `gst_e_way_bills`(`tenantId`, `outboundDispatchId`);
