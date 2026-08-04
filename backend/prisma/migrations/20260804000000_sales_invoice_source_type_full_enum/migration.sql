-- Fix SalesInvoiceSourceType: include both PROFORMA_INVOICE and CRM_TAX_INVOICE.
-- Prior CRM bridge migration rewrote the ENUM without PROFORMA_INVOICE; that migration
-- may also be missing on some DBs. Prisma schema expects all five values.
-- Unknown enum values under MySQL non-strict mode are stored as '' and surface as:
--   Value '' not found in enum 'SalesInvoiceSourceType'

ALTER TABLE `sales_invoices`
  MODIFY COLUMN `sourceType` ENUM(
    'DIRECT',
    'SALES_ORDER',
    'OUTBOUND_DISPATCH',
    'PROFORMA_INVOICE',
    'CRM_TAX_INVOICE'
  ) NOT NULL DEFAULT 'DIRECT';
