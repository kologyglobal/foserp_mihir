/* =========================================================
   LIVE FIX — Purchase invoice line dual-UOM snapshot columns
   Migration: 20260804130000_purchase_invoice_dual_uom_snapshots

   Fixes POST /purchase/invoices → 400 PRISMA_VALIDATION or 500 P2022
   when deployed API expects uomQuantitySnapshot / uomConversionFactorSnapshot /
   purchaseUomCodeSnapshot on purchase_invoice_lines.

   Run in phpMyAdmin on stage DB (u233611619_foserp). Idempotent.
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at;
SET @db := DATABASE();

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='uomQuantitySnapshot'),
  'SELECT ''OK purchase_invoice_lines.uomQuantitySnapshot'' AS msg',
  'ALTER TABLE `purchase_invoice_lines` ADD COLUMN `uomQuantitySnapshot` DECIMAL(18, 4) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='uomConversionFactorSnapshot'),
  'SELECT ''OK purchase_invoice_lines.uomConversionFactorSnapshot'' AS msg',
  'ALTER TABLE `purchase_invoice_lines` ADD COLUMN `uomConversionFactorSnapshot` DECIMAL(18, 4) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='purchaseUomCodeSnapshot'),
  'SELECT ''OK purchase_invoice_lines.purchaseUomCodeSnapshot'' AS msg',
  'ALTER TABLE `purchase_invoice_lines` ADD COLUMN `purchaseUomCodeSnapshot` VARCHAR(32) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260804130000_purchase_invoice_dual_uom_snapshots', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260804130000_purchase_invoice_dual_uom_snapshots');

SELECT 'purchase_invoice_lines.uomQuantitySnapshot' AS check_item,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='uomQuantitySnapshot'
  ) THEN 'OK' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'purchase_invoice_lines.uomConversionFactorSnapshot',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='uomConversionFactorSnapshot'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'purchase_invoice_lines.purchaseUomCodeSnapshot',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='purchaseUomCodeSnapshot'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'table purchase_invoices',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoices'
  ) THEN 'OK' ELSE 'MISSING' END;
