/* Local/stage fix — POST /purchase/invoices 400 PRISMA_VALIDATION / P2022
   Adds missing purchase_invoice_lines dual-UOM columns + purchase_settings.planningConsolidationEnabled
   Run: mysql -u root fos_erp < backend/scripts/live-fix-purchase-invoice-post-local.sql
*/
SELECT DATABASE() AS current_db, NOW() AS ran_at;
SET @db := DATABASE();

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_invoice_lines' AND COLUMN_NAME='uomQuantitySnapshot'),
  'SELECT ''OK uomQuantitySnapshot'' AS msg',
  'ALTER TABLE `purchase_invoice_lines`
     ADD COLUMN `uomQuantitySnapshot` DECIMAL(18, 4) NULL,
     ADD COLUMN `uomConversionFactorSnapshot` DECIMAL(18, 4) NULL,
     ADD COLUMN `purchaseUomCodeSnapshot` VARCHAR(32) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_settings' AND COLUMN_NAME='planningConsolidationEnabled'),
  'SELECT ''OK planningConsolidationEnabled'' AS msg',
  'ALTER TABLE `purchase_settings` ADD COLUMN `planningConsolidationEnabled` BOOLEAN NOT NULL DEFAULT true'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260804130000_purchase_invoice_dual_uom_snapshots', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260804130000_purchase_invoice_dual_uom_snapshots');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260804140000_purchase_planning_consolidation', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260804140000_purchase_planning_consolidation');
