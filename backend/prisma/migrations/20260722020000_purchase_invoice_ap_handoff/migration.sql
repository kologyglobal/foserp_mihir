-- Soft AP handoff link: Purchase Invoice → VendorInvoice draft (no FK; Accounting remains SoT).

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoices' AND COLUMN_NAME='vendorInvoiceId'
    ),
    'SELECT 1',
    'ALTER TABLE `purchase_invoices`
      ADD COLUMN `vendorInvoiceId` VARCHAR(36) NULL,
      ADD COLUMN `vendorInvoiceDraftRef` VARCHAR(64) NULL,
      ADD INDEX `purchase_invoices_tenantId_vendorInvoiceId_idx`(`tenantId`, `vendorInvoiceId`)'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
