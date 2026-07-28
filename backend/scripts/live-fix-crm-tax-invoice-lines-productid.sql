/* =========================================================
   FIX sync 500 — restore productId on crm_tax_invoice_lines
   Current deployed Prisma expects `productId` (NOT itemId).
   If you earlier ran an itemId script that DROPPED productId,
   run this on u233611619_foserp.
   ========================================================= */

SELECT DATABASE() AS db;

SELECT
  need.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'productId' AS column_name UNION ALL
  SELECT 'itemId' UNION ALL
  SELECT 'invoiceId' UNION ALL
  SELECT 'itemCode' UNION ALL
  SELECT 'deletedAt'
) AS need
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = DATABASE()
 AND c.table_name = 'crm_tax_invoice_lines'
 AND c.column_name = need.column_name
ORDER BY need.column_name;

/* Add productId if missing (#1060 = already exists → skip) */
ALTER TABLE `crm_tax_invoice_lines`
  ADD COLUMN `productId` VARCHAR(191) NULL AFTER `lineNo`;

/* Optional: keep itemId if present — Prisma ignores unknown columns */

/* Smoke — must NOT error */
SELECT `id`, `productId`, `invoiceId`, `lineNo`, `itemCode`, `deletedAt`
FROM `crm_tax_invoice_lines`
LIMIT 1;

SELECT COUNT(*) AS receipts FROM `crm_payment_receipts` WHERE `deletedAt` IS NULL;
SELECT COUNT(*) AS invoices FROM `crm_tax_invoices` WHERE `deletedAt` IS NULL;
SELECT COUNT(*) AS lines FROM `crm_tax_invoice_lines` WHERE `deletedAt` IS NULL;
SELECT COUNT(*) AS allocations FROM `crm_payment_allocations` WHERE `deletedAt` IS NULL;

/* After — productId must be OK */
SELECT
  need.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'productId' AS column_name UNION ALL
  SELECT 'invoiceId' UNION ALL
  SELECT 'itemCode' UNION ALL
  SELECT 'deletedAt'
) AS need
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = DATABASE()
 AND c.table_name = 'crm_tax_invoice_lines'
 AND c.column_name = need.column_name
ORDER BY need.column_name;
