/* =========================================================
   Commercial column check — Prisma expects productId
   DB: u233611619_foserp
   ========================================================= */

SELECT DATABASE() AS db;

SELECT t.wanted AS table_name,
       CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (
  SELECT 'crm_payment_receipts' AS wanted UNION ALL
  SELECT 'crm_tax_invoices' UNION ALL
  SELECT 'crm_tax_invoice_lines' UNION ALL
  SELECT 'crm_payment_allocations'
) t
LEFT JOIN information_schema.tables i
  ON i.table_schema = DATABASE() AND i.table_name = t.wanted
ORDER BY table_name;

SELECT
  need.table_name,
  need.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'crm_payment_receipts' AS table_name, 'proformaInvoiceId' AS column_name UNION ALL
  SELECT 'crm_payment_receipts', 'unallocatedAmount' UNION ALL
  SELECT 'crm_payment_receipts', 'paymentMode' UNION ALL
  SELECT 'crm_payment_receipts', 'deletedAt' UNION ALL
  SELECT 'crm_tax_invoices', 'paymentStatus' UNION ALL
  SELECT 'crm_tax_invoices', 'balanceDue' UNION ALL
  SELECT 'crm_tax_invoices', 'amountPaid' UNION ALL
  SELECT 'crm_tax_invoices', 'deletedAt' UNION ALL
  SELECT 'crm_tax_invoice_lines', 'productId' UNION ALL
  SELECT 'crm_tax_invoice_lines', 'invoiceId' UNION ALL
  SELECT 'crm_tax_invoice_lines', 'itemCode' UNION ALL
  SELECT 'crm_tax_invoice_lines', 'deletedAt' UNION ALL
  SELECT 'crm_payment_allocations', 'receiptId' UNION ALL
  SELECT 'crm_payment_allocations', 'invoiceId' UNION ALL
  SELECT 'crm_payment_allocations', 'allocationDate' UNION ALL
  SELECT 'crm_payment_allocations', 'deletedAt'
) AS need
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = DATABASE()
 AND c.table_name = need.table_name
 AND c.column_name = need.column_name
ORDER BY status DESC, need.table_name, need.column_name;

/* Smoke */
SELECT COUNT(*) AS receipts FROM crm_payment_receipts WHERE deletedAt IS NULL;
SELECT COUNT(*) AS invoices FROM crm_tax_invoices WHERE deletedAt IS NULL;
SELECT id, productId, invoiceId FROM crm_tax_invoice_lines LIMIT 1;
SELECT COUNT(*) AS allocations FROM crm_payment_allocations WHERE deletedAt IS NULL;
