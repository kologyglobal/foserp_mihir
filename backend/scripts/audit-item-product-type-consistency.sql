-- Item Master productType vs itemType audit (purchase BOI picker / filter).
-- Read-only. Run on live/stage after backup.
-- Prisma uses camelCase column names on master_items.

-- 1) Missing productType but itemType set (picker showed blank Product Type column)
SELECT
  mi.id,
  mi.itemCode,
  mi.itemName,
  mi.itemType,
  mi.productType,
  mic.name AS categoryName
FROM master_items mi
LEFT JOIN master_item_categories mic ON mic.id = mi.categoryId AND mic.tenantId = mi.tenantId
WHERE mi.deletedAt IS NULL
  AND (mi.productType IS NULL OR TRIM(mi.productType) = '')
ORDER BY mi.itemType, mi.itemCode
LIMIT 200;

-- 2) itemType bought_out but productType not boi (should be BOI in purchase lines)
SELECT
  mi.itemCode,
  mi.itemName,
  mi.itemType,
  mi.productType
FROM master_items mi
WHERE mi.deletedAt IS NULL
  AND mi.itemType = 'bought_out'
  AND (mi.productType IS NULL OR mi.productType NOT IN ('boi', 'bought_out'))
LIMIT 100;

-- 3) itemType sub_assembly / finished_good incorrectly tagged as boi
SELECT
  mi.itemCode,
  mi.itemName,
  mi.itemType,
  mi.productType
FROM master_items mi
WHERE mi.deletedAt IS NULL
  AND mi.itemType IN ('sub_assembly', 'finished_good')
  AND mi.productType IN ('boi', 'bought_out')
LIMIT 100;

-- 4) Conflicting raw material itemType with finish/sub-assembly productType
SELECT
  mi.itemCode,
  mi.itemName,
  mi.itemType,
  mi.productType
FROM master_items mi
WHERE mi.deletedAt IS NULL
  AND mi.itemType = 'raw'
  AND mi.productType IN ('finish_product', 'sub_assembly', 'assembly_product', 'boi')
LIMIT 100;
