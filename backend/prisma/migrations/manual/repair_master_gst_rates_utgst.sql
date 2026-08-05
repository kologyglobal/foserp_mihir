-- Repair: SO tax header + master_gst_rates utgst/cess (Prisma P2022)
-- Source migration: 20260805310000_so_place_of_supply_tax_header
-- Prefer (idempotent): npm run db:repair-gst-utgst  against the SAME DB the API uses.
--
-- If you run this SQL by hand: each ADD fails if the column already exists — skip that line.

-- crm_sales_orders (sales order place-of-supply / tax header)
ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupply` VARCHAR(200) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyStateCode` VARCHAR(8) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplySource` VARCHAR(32) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyOverride` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyOverrideReason` VARCHAR(500) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `supplierStateCode` VARCHAR(8) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `supplyType` VARCHAR(32) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `gstScheme` VARCHAR(32) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `cgstAmount` DECIMAL(18, 2) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `sgstAmount` DECIMAL(18, 2) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `utgstAmount` DECIMAL(18, 2) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `igstAmount` DECIMAL(18, 2) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `cessAmount` DECIMAL(18, 2) NULL;

-- master_gst_rates
ALTER TABLE `master_gst_rates` ADD COLUMN `utgst` DECIMAL(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE `master_gst_rates` ADD COLUMN `cess` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- Verify:
-- SHOW COLUMNS FROM crm_sales_orders LIKE 'placeOfSupply';
-- SHOW COLUMNS FROM master_gst_rates LIKE 'utgst';
