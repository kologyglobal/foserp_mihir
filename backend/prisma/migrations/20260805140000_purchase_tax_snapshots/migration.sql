-- Purchase tax snapshot fields: PO → GRN → Invoice chain immutability.

ALTER TABLE `purchase_order_lines`
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `purchase_invoice_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';
