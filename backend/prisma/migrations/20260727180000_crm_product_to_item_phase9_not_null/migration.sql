-- Phase 9: enforce non-null itemId on CRM commercial headers/lines (Product fallback removed in app).

UPDATE crm_quotations q
INNER JOIN master_products p ON p.id = q.productId
SET q.itemId = p.fgItemId
WHERE (q.itemId IS NULL OR q.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

UPDATE crm_sales_orders so
INNER JOIN master_products p ON p.id = so.productId
SET so.itemId = p.fgItemId
WHERE (so.itemId IS NULL OR so.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

UPDATE crm_opportunity_lines ol
INNER JOIN master_products p ON p.id = ol.productId
SET ol.itemId = p.fgItemId
WHERE (ol.itemId IS NULL OR ol.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

UPDATE crm_sales_orders so
INNER JOIN (
  SELECT mi.tenantId, MIN(mi.id) AS itemId
  FROM master_items mi
  WHERE mi.deletedAt IS NULL
  GROUP BY mi.tenantId
) pick ON pick.tenantId = so.tenantId
SET so.itemId = pick.itemId
WHERE (so.itemId IS NULL OR so.itemId = '');

UPDATE crm_quotations q
INNER JOIN (
  SELECT mi.tenantId, MIN(mi.id) AS itemId
  FROM master_items mi
  WHERE mi.deletedAt IS NULL
  GROUP BY mi.tenantId
) pick ON pick.tenantId = q.tenantId
SET q.itemId = pick.itemId
WHERE (q.itemId IS NULL OR q.itemId = '');

-- Soft-delete active leftovers that still lack itemId (no product / no tenant items).
UPDATE crm_sales_orders
SET deletedAt = UTC_TIMESTAMP(3)
WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL;

UPDATE crm_quotations
SET deletedAt = UTC_TIMESTAMP(3), status = 'cancelled'
WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL;

-- Hard-delete remaining null-itemId shells (typically ephemeral test tenants with no items).
DELETE FROM crm_sales_orders WHERE itemId IS NULL OR itemId = '';
DELETE FROM crm_quotations WHERE itemId IS NULL OR itemId = '';
DELETE FROM crm_opportunity_lines WHERE itemId IS NULL OR itemId = '';

ALTER TABLE `crm_opportunity_lines`
  MODIFY `itemId` VARCHAR(191) NOT NULL;

ALTER TABLE `crm_quotations`
  MODIFY `itemId` VARCHAR(191) NOT NULL;

ALTER TABLE `crm_sales_orders`
  MODIFY `itemId` VARCHAR(191) NOT NULL;
