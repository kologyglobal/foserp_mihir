-- Commercial proforma/tax invoice lines: add itemId, backfill, drop productId.

ALTER TABLE `crm_proforma_invoice_lines`
  ADD COLUMN `itemId` VARCHAR(191) NULL AFTER `lineNo`;

ALTER TABLE `crm_tax_invoice_lines`
  ADD COLUMN `itemId` VARCHAR(191) NULL AFTER `lineNo`;

-- 1) productId → MasterProduct.fgItemId
UPDATE crm_proforma_invoice_lines pl
INNER JOIN master_products p ON p.id = pl.productId
SET pl.itemId = p.fgItemId
WHERE (pl.itemId IS NULL OR pl.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

UPDATE crm_tax_invoice_lines tl
INNER JOIN master_products p ON p.id = tl.productId
SET tl.itemId = p.fgItemId
WHERE (tl.itemId IS NULL OR tl.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

-- 2) Match itemCode within tenant
UPDATE crm_proforma_invoice_lines pl
INNER JOIN crm_proforma_invoices pi ON pi.id = pl.proformaId
INNER JOIN master_items mi
  ON mi.tenantId = pi.tenantId
 AND mi.code = pl.itemCode
 AND mi.deletedAt IS NULL
SET pl.itemId = mi.id
WHERE (pl.itemId IS NULL OR pl.itemId = '')
  AND pl.itemCode IS NOT NULL
  AND pl.itemCode <> '';

UPDATE crm_tax_invoice_lines tl
INNER JOIN crm_tax_invoices ti ON ti.id = tl.invoiceId
INNER JOIN master_items mi
  ON mi.tenantId = ti.tenantId
 AND mi.code = tl.itemCode
 AND mi.deletedAt IS NULL
SET tl.itemId = mi.id
WHERE (tl.itemId IS NULL OR tl.itemId = '')
  AND tl.itemCode IS NOT NULL
  AND tl.itemCode <> '';

-- 3) Last resort: any active item in tenant (keeps NOT NULL feasible for demo/test leftovers)
UPDATE crm_proforma_invoice_lines pl
INNER JOIN crm_proforma_invoices pi ON pi.id = pl.proformaId
INNER JOIN (
  SELECT tenantId, MIN(id) AS itemId
  FROM master_items
  WHERE deletedAt IS NULL
  GROUP BY tenantId
) pick ON pick.tenantId = pi.tenantId
SET pl.itemId = pick.itemId
WHERE (pl.itemId IS NULL OR pl.itemId = '');

UPDATE crm_tax_invoice_lines tl
INNER JOIN crm_tax_invoices ti ON ti.id = tl.invoiceId
INNER JOIN (
  SELECT tenantId, MIN(id) AS itemId
  FROM master_items
  WHERE deletedAt IS NULL
  GROUP BY tenantId
) pick ON pick.tenantId = ti.tenantId
SET tl.itemId = pick.itemId
WHERE (tl.itemId IS NULL OR tl.itemId = '');

-- Orphan lines with no tenant items: delete
DELETE FROM crm_proforma_invoice_lines WHERE itemId IS NULL OR itemId = '';
DELETE FROM crm_tax_invoice_lines WHERE itemId IS NULL OR itemId = '';

ALTER TABLE `crm_proforma_invoice_lines`
  MODIFY `itemId` VARCHAR(191) NOT NULL,
  DROP COLUMN `productId`;

ALTER TABLE `crm_tax_invoice_lines`
  MODIFY `itemId` VARCHAR(191) NOT NULL,
  DROP COLUMN `productId`;

CREATE INDEX `crm_proforma_invoice_lines_tenantId_itemId_idx`
  ON `crm_proforma_invoice_lines` (`tenantId`, `itemId`);

CREATE INDEX `crm_tax_invoice_lines_tenantId_itemId_idx`
  ON `crm_tax_invoice_lines` (`tenantId`, `itemId`);
