-- Sales Order commercial GST header (Place of Supply / supply type / scheme)
-- Master GST rate UTGST + cess components for scheme completeness

ALTER TABLE `crm_sales_orders`
  ADD COLUMN `placeOfSupply` VARCHAR(200) NULL,
  ADD COLUMN `placeOfSupplyStateCode` VARCHAR(8) NULL,
  ADD COLUMN `placeOfSupplySource` VARCHAR(32) NULL,
  ADD COLUMN `placeOfSupplyOverride` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `placeOfSupplyOverrideReason` VARCHAR(500) NULL,
  ADD COLUMN `supplierStateCode` VARCHAR(8) NULL,
  ADD COLUMN `supplyType` VARCHAR(32) NULL,
  ADD COLUMN `gstScheme` VARCHAR(32) NULL,
  ADD COLUMN `cgstAmount` DECIMAL(18, 2) NULL,
  ADD COLUMN `sgstAmount` DECIMAL(18, 2) NULL,
  ADD COLUMN `utgstAmount` DECIMAL(18, 2) NULL,
  ADD COLUMN `igstAmount` DECIMAL(18, 2) NULL,
  ADD COLUMN `cessAmount` DECIMAL(18, 2) NULL;

ALTER TABLE `master_gst_rates`
  ADD COLUMN `utgst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cess` DECIMAL(5, 2) NOT NULL DEFAULT 0;
