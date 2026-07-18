-- Phase 3A3: Sales invoice draft workflow fields

ALTER TABLE `sales_invoices`
  ADD COLUMN `postingDate` DATE NULL AFTER `invoiceDate`,
  ADD COLUMN `referenceNumber` VARCHAR(64) NULL AFTER `postingDate`,
  ADD COLUMN `customerPoNumber` VARCHAR(64) NULL AFTER `referenceNumber`,
  ADD COLUMN `paymentTermsDays` INT NULL AFTER `customerPoNumber`,
  ADD COLUMN `freightAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `paymentTermsDays`,
  ADD COLUMN `otherChargesAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `freightAmount`,
  ADD COLUMN `customerStateCodeSnapshot` VARCHAR(8) NULL AFTER `customerBillingAddressSnapshot`,
  ADD COLUMN `customerShippingAddressSnapshot` JSON NULL AFTER `customerStateCodeSnapshot`,
  ADD COLUMN `calculationContext` JSON NULL AFTER `customerShippingAddressSnapshot`;

ALTER TABLE `sales_invoice_lines`
  ADD COLUMN `sourceLineId` VARCHAR(64) NULL AFTER `lineNumber`,
  ADD COLUMN `grossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `unitRate`;
