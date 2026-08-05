-- Backfill master_items.productType from itemType where blank (safe defaults).
-- Review audit-item-product-type-consistency.sql output BEFORE running on live.
-- Columns: code, name, itemType, productType (camelCase per Prisma).

SET @tenantSlug := 'vasant-trailers';  /* change if needed */
SET @tenantId := (
  SELECT id FROM tenants WHERE slug = @tenantSlug AND deletedAt IS NULL LIMIT 1
);

SELECT @tenantSlug AS tenant_slug, @tenantId AS tenant_id;

-- Preview rows that will change
SELECT
  mi.code AS itemCode,
  mi.itemType,
  mi.productType AS currentProductType,
  CASE mi.itemType
    WHEN 'raw' THEN 'raw_material'
    WHEN 'consumable' THEN 'raw_material'
    WHEN 'bought_out' THEN 'boi'
    WHEN 'sub_assembly' THEN 'sub_assembly'
    WHEN 'finished_good' THEN 'finish_product'
    WHEN 'scrap' THEN 'scrap'
    WHEN 'service' THEN 'service'
    ELSE NULL
  END AS newProductType
FROM master_items mi
WHERE mi.tenantId = @tenantId
  AND mi.deletedAt IS NULL
  AND (mi.productType IS NULL OR TRIM(mi.productType) = '')
  AND mi.itemType IN ('raw', 'consumable', 'bought_out', 'sub_assembly', 'finished_good', 'scrap', 'service');

-- Uncomment to apply after review:
/*
UPDATE master_items mi
SET
  mi.productType = CASE mi.itemType
    WHEN 'raw' THEN 'raw_material'
    WHEN 'consumable' THEN 'raw_material'
    WHEN 'bought_out' THEN 'boi'
    WHEN 'sub_assembly' THEN 'sub_assembly'
    WHEN 'finished_good' THEN 'finish_product'
    WHEN 'scrap' THEN 'scrap'
    WHEN 'service' THEN 'service'
    ELSE mi.productType
  END,
  mi.updatedAt = NOW(3)
WHERE mi.tenantId = @tenantId
  AND mi.deletedAt IS NULL
  AND (mi.productType IS NULL OR TRIM(mi.productType) = '')
  AND mi.itemType IN ('raw', 'consumable', 'bought_out', 'sub_assembly', 'finished_good', 'scrap', 'service');
*/
