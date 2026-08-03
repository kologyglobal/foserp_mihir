-- PO line: GST/HSN/bin snapshots and QC fields from item master
ALTER TABLE `purchase_order_lines`
  ADD COLUMN `gstGroupId` VARCHAR(191) NULL,
  ADD COLUMN `hsnId` VARCHAR(191) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `binId` VARCHAR(191) NULL,
  ADD COLUMN `qcRequiredSnapshot` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `qualityTestGroupCodeSnapshot` VARCHAR(32) NULL;

CREATE INDEX `purchase_order_lines_tenantId_gstGroupId_idx` ON `purchase_order_lines`(`tenantId`, `gstGroupId`);
CREATE INDEX `purchase_order_lines_tenantId_hsnId_idx` ON `purchase_order_lines`(`tenantId`, `hsnId`);
CREATE INDEX `purchase_order_lines_tenantId_binId_idx` ON `purchase_order_lines`(`tenantId`, `binId`);

ALTER TABLE `purchase_order_lines`
  ADD CONSTRAINT `purchase_order_lines_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_order_lines_hsnId_fkey` FOREIGN KEY (`hsnId`) REFERENCES `master_hsn_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_order_lines_binId_fkey` FOREIGN KEY (`binId`) REFERENCES `master_bins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
