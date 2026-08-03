/* =========================================================
   LIVE FIX — Prisma P3018 migration blocker
   Failed: 20260727190000_crm_product_to_item_phase10_drop_product_id

   Typical errors:
   - Can't DROP 'productId'; check that column/key exists (1091)
   - Unknown column 'dr.productId' in 'ON' (1054) — partial prior run

   Run in phpMyAdmin AFTER selecting live DB (u233611619_foserp).
   Then redeploy — migrate deploy should continue (inventory costing+).
   ========================================================= */

SELECT DATABASE() AS current_db;
SET @db := DATABASE();

/* ── 1) Backfill dispatch itemId from sales order header ── */
UPDATE dispatch_requirements dr
INNER JOIN crm_sales_orders so ON so.id = dr.salesOrderId
SET dr.itemId = so.itemId
WHERE (dr.itemId IS NULL OR dr.itemId = '')
  AND so.itemId IS NOT NULL
  AND so.itemId <> '';

/* Optional: product master backfill when dispatch.productId still exists */
SET @has_dr_product := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dispatch_requirements' AND COLUMN_NAME = 'productId'
);
SET @sql := IF(
  @has_dr_product > 0,
  'UPDATE dispatch_requirements dr INNER JOIN master_products p ON p.id = dr.productId SET dr.itemId = p.fgItemId WHERE (dr.itemId IS NULL OR dr.itemId = '''') AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''''''',
  'SELECT ''skip dispatch_requirements productId backfill'' AS step1b'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 2) Drop productId columns when present ── */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_opportunity_lines' AND COLUMN_NAME='productId'),
  'ALTER TABLE `crm_opportunity_lines` DROP COLUMN `productId`',
  'SELECT ''OK crm_opportunity_lines.productId absent'' AS step2a'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_quotations' AND COLUMN_NAME='productId'),
  'ALTER TABLE `crm_quotations` DROP COLUMN `productId`',
  'SELECT ''OK crm_quotations.productId absent'' AS step2b'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_sales_orders' AND COLUMN_NAME='productId'),
  'ALTER TABLE `crm_sales_orders` DROP COLUMN `productId`',
  'SELECT ''OK crm_sales_orders.productId absent'' AS step2c'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='dispatch_requirements' AND COLUMN_NAME='productId'),
  'ALTER TABLE `dispatch_requirements` DROP COLUMN `productId`',
  'SELECT ''OK dispatch_requirements.productId absent'' AS step2d'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 3) Mark failed migration as applied (with checksum for Prisma) ── */
UPDATE `_prisma_migrations`
SET
  `finished_at` = COALESCE(`finished_at`, NOW(3)),
  `applied_steps_count` = GREATEST(`applied_steps_count`, 1),
  `checksum` = '718d8dfa30dbb3430bdcf207454f3a6e457b10aabcabf6a495ea637b38ee9cac',
  `logs` = NULL,
  `rolled_back_at` = NULL
WHERE `migration_name` = '20260727190000_crm_product_to_item_phase10_drop_product_id'
  AND `finished_at` IS NULL;

SELECT
  migration_name,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM `_prisma_migrations`
WHERE migration_name = '20260727190000_crm_product_to_item_phase10_drop_product_id';

SELECT
  TABLE_NAME,
  COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME IN ('crm_opportunity_lines', 'crm_quotations', 'crm_sales_orders', 'dispatch_requirements')
  AND COLUMN_NAME = 'productId';

SELECT 'Phase10 blocker cleared — redeploy Hostinger build' AS status;
