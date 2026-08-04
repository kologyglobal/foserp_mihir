-- Purchase invoice line dual-UOM snapshots for stable print/PDF output.
ALTER TABLE `purchase_invoice_lines`
  ADD COLUMN `uomQuantitySnapshot` DECIMAL(18, 4) NULL,
  ADD COLUMN `uomConversionFactorSnapshot` DECIMAL(18, 4) NULL,
  ADD COLUMN `purchaseUomCodeSnapshot` VARCHAR(32) NULL;
