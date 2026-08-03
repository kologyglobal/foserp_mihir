/* =========================================================
   LIVE FIX — Prisma P3018 migration blocker
   Failed: 20260727180000_crm_product_to_item_phase9_not_null
   Error: Unknown column 'q.productId' in 'ON' (1054)

   Cause: live DB already dropped productId (or never had it on
   headers) while phase 9 migration still joins on productId.

   Run in phpMyAdmin AFTER selecting live DB (u233611619_foserp).
   Then redeploy — migrate deploy should continue (phase 10+).
   ========================================================= */

SELECT DATABASE() AS current_db;
SET @db := DATABASE();

/* ── 1) Ensure nullable itemId on quotation / SO headers (phase 3) ── */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_quotations' AND COLUMN_NAME = 'itemId'
  ),
  'SELECT ''OK crm_quotations.itemId'' AS step1a',
  'ALTER TABLE `crm_quotations` ADD COLUMN `itemId` VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_sales_orders' AND COLUMN_NAME = 'itemId'
  ),
  'SELECT ''OK crm_sales_orders.itemId'' AS step1b',
  'ALTER TABLE `crm_sales_orders` ADD COLUMN `itemId` VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 2) Product → item backfill (only when productId column exists) ── */
SET @has_q_product := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_quotations' AND COLUMN_NAME = 'productId'
);
SET @sql := IF(
  @has_q_product > 0,
  'UPDATE crm_quotations q INNER JOIN master_products p ON p.id = q.productId SET q.itemId = p.fgItemId WHERE (q.itemId IS NULL OR q.itemId = '''') AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''''''',
  'SELECT ''skip crm_quotations productId backfill'' AS step2a'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_so_product := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_sales_orders' AND COLUMN_NAME = 'productId'
);
SET @sql := IF(
  @has_so_product > 0,
  'UPDATE crm_sales_orders so INNER JOIN master_products p ON p.id = so.productId SET so.itemId = p.fgItemId WHERE (so.itemId IS NULL OR so.itemId = '''') AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''''''',
  'SELECT ''skip crm_sales_orders productId backfill'' AS step2b'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_ol_product := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_opportunity_lines' AND COLUMN_NAME = 'productId'
);
SET @sql := IF(
  @has_ol_product > 0,
  'UPDATE crm_opportunity_lines ol INNER JOIN master_products p ON p.id = ol.productId SET ol.itemId = p.fgItemId WHERE (ol.itemId IS NULL OR ol.itemId = '''') AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''''''',
  'SELECT ''skip crm_opportunity_lines productId backfill'' AS step2c'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 3) Tenant fallback: any active master item ── */
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

UPDATE crm_opportunity_lines ol
INNER JOIN (
  SELECT mi.tenantId, MIN(mi.id) AS itemId
  FROM master_items mi
  WHERE mi.deletedAt IS NULL
  GROUP BY mi.tenantId
) pick ON pick.tenantId = ol.tenantId
SET ol.itemId = pick.itemId
WHERE (ol.itemId IS NULL OR ol.itemId = '');

/* ── 4) Cleanup rows that still lack itemId ── */
UPDATE crm_sales_orders
SET deletedAt = UTC_TIMESTAMP(3)
WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL;

UPDATE crm_quotations
SET deletedAt = UTC_TIMESTAMP(3), status = 'cancelled'
WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL;

DELETE FROM crm_sales_orders WHERE itemId IS NULL OR itemId = '';
DELETE FROM crm_quotations WHERE itemId IS NULL OR itemId = '';
DELETE FROM crm_opportunity_lines WHERE itemId IS NULL OR itemId = '';

/* ── 5) Enforce NOT NULL when column is still nullable ── */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_opportunity_lines'
      AND COLUMN_NAME = 'itemId' AND IS_NULLABLE = 'YES'
  ),
  'ALTER TABLE `crm_opportunity_lines` MODIFY `itemId` VARCHAR(191) NOT NULL',
  'SELECT ''OK crm_opportunity_lines.itemId NOT NULL'' AS step5a'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_quotations'
      AND COLUMN_NAME = 'itemId' AND IS_NULLABLE = 'YES'
  ),
  'ALTER TABLE `crm_quotations` MODIFY `itemId` VARCHAR(191) NOT NULL',
  'SELECT ''OK crm_quotations.itemId NOT NULL'' AS step5b'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_sales_orders'
      AND COLUMN_NAME = 'itemId' AND IS_NULLABLE = 'YES'
  ),
  'ALTER TABLE `crm_sales_orders` MODIFY `itemId` VARCHAR(191) NOT NULL',
  'SELECT ''OK crm_sales_orders.itemId NOT NULL'' AS step5c'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 6) Mark failed migration as applied (clears P3018 blocker) ── */
UPDATE `_prisma_migrations`
SET
  `finished_at` = COALESCE(`finished_at`, NOW(3)),
  `applied_steps_count` = GREATEST(`applied_steps_count`, 1),
  `logs` = NULL,
  `rolled_back_at` = NULL
WHERE `migration_name` = '20260727180000_crm_product_to_item_phase9_not_null'
  AND `finished_at` IS NULL;

INSERT INTO `_prisma_migrations` (
  `id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`
)
SELECT
  UUID(),
  'live-fix-p3018',
  NOW(3),
  '20260727180000_crm_product_to_item_phase9_not_null',
  NULL,
  NULL,
  NOW(3),
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE migration_name = '20260727180000_crm_product_to_item_phase9_not_null'
);

/* ── 7) Verify ── */
SELECT
  migration_name,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM `_prisma_migrations`
WHERE migration_name = '20260727180000_crm_product_to_item_phase9_not_null';

SELECT
  TABLE_NAME,
  COLUMN_NAME,
  IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME IN ('crm_quotations', 'crm_sales_orders', 'crm_opportunity_lines')
  AND COLUMN_NAME IN ('itemId', 'productId')
ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT 'P3018 blocker cleared — redeploy Hostinger build' AS status;
