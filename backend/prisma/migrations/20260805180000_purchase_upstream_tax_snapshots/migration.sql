-- HSN/GST snapshots on upstream purchase lines (PR → RFQ → VQ) and return lines.

ALTER TABLE `purchase_requisition_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `request_for_quotation_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `vendor_quotation_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `purchase_return_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';
