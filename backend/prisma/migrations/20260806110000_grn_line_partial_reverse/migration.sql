-- GRN line partial reverse: track reversed quantities per receipt line.

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `reversedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `reversedAcceptedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `reversedRejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `reversedAt` DATETIME(3) NULL;
