/* =========================================================
   LIVE DEPLOY — MasterItem schema (fixes Prisma P2022)
   Covers migrations that add columns Prisma selects on master_items:
     - 20260722033000_inventory_stock_status_batch_serial
     - 20260723210000_master_item_sales_fields
     - 20260727180000_purchase_multi_unit_uom
     - 20260728140000_grn_receiving_tolerance
     - 20260730110000_item_master_image_url

   Idempotent — safe to re-run. Run in phpMyAdmin or mysql CLI.
   After this: restart Node app on Hostinger.
   Optional: npx tsx scripts/prisma-cli.ts migrate deploy (SSH)
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'master_items_p2022_fix' AS script;
SET @db := DATABASE();

/* --- batchTracked / serialTracked --- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='batchTracked'),
  'SELECT ''OK batchTracked'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `batchTracked` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='serialTracked'),
  'SELECT ''OK serialTracked'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `serialTracked` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- CRM / sales commercial fields --- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='defaultFulfilmentMethod'),
  'SELECT ''OK sales fields'' AS msg',
  'ALTER TABLE `master_items`
     ADD COLUMN `defaultFulfilmentMethod` ENUM(''STOCK'',''PURCHASE'',''PRODUCTION'',''SUBCONTRACT'',''SERVICE'',''MANUAL'') NOT NULL DEFAULT ''MANUAL'',
     ADD COLUMN `salesDescription` TEXT NULL,
     ADD COLUMN `salesUomId` VARCHAR(191) NULL,
     ADD COLUMN `defaultSalesRate` DECIMAL(18,2) NOT NULL DEFAULT 0,
     ADD COLUMN `salesLeadDays` INT NOT NULL DEFAULT 0,
     ADD COLUMN `salesAllowed` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `productionAllowed` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND INDEX_NAME='master_items_tenantId_salesAllowed_idx'),
  'SELECT 1',
  'CREATE INDEX `master_items_tenantId_salesAllowed_idx` ON `master_items`(`tenantId`, `salesAllowed`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND CONSTRAINT_NAME='master_items_salesUomId_fkey'),
  'SELECT 1',
  'ALTER TABLE `master_items` ADD CONSTRAINT `master_items_salesUomId_fkey`
     FOREIGN KEY (`salesUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- uomConversionFactor (purchase multi-unit) --- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='uomConversionFactor'),
  'SELECT ''OK uomConversionFactor'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `uomConversionFactor` DECIMAL(18,4) NOT NULL DEFAULT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `master_items`
SET `uomConversionFactor` = CASE
  WHEN `purchaseQtyPerUom` IS NULL OR `purchaseQtyPerUom` <= 0 THEN 1
  ELSE `purchaseQtyPerUom`
END
WHERE EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='uomConversionFactor'
)
AND (`uomConversionFactor` = 0 OR `uomConversionFactor` IS NULL);

/* --- GRN receiving tolerance --- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='receivingTolerancePercentage'),
  'SELECT ''OK receivingTolerancePercentage'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `receivingTolerancePercentage` DECIMAL(5,2) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Item Master product image --- */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='imageUrl'),
  'SELECT ''OK imageUrl'' AS msg',
  'ALTER TABLE `master_items` ADD COLUMN `imageUrl` VARCHAR(500) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Mark Prisma migrations (optional if _prisma_migrations exists) --- */
SET @hasPrismaMigrations := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = '_prisma_migrations'
);

/* Helper: insert migration row if missing */
SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT ''SKIP: no _prisma_migrations table'' AS prisma_note',
  'INSERT INTO `_prisma_migrations`
    (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
   SELECT UUID(), ''524b06198efc0ca85e311d0bc68d2754cc7af62d7d1784d81440ca2458f0'', NOW(3),
          ''20260722033000_inventory_stock_status_batch_serial'', NULL, NULL, NOW(3), 1
   FROM DUAL
   WHERE NOT EXISTS (
     SELECT 1 FROM `_prisma_migrations`
     WHERE `migration_name` = ''20260722033000_inventory_stock_status_batch_serial''
   )'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT 1',
  'INSERT INTO `_prisma_migrations`
    (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
   SELECT UUID(), ''d0b4ebed31c611318f3871e860cf683de7aac75095d154abaeba2091eb253163'', NOW(3),
          ''20260723210000_master_item_sales_fields'', NULL, NULL, NOW(3), 1
   FROM DUAL
   WHERE NOT EXISTS (
     SELECT 1 FROM `_prisma_migrations`
     WHERE `migration_name` = ''20260723210000_master_item_sales_fields''
   )'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT 1',
  'INSERT INTO `_prisma_migrations`
    (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
   SELECT UUID(), ''1bf6f3b4a500b8807c2fc330f0f485dbbbdda5d4a68f621aad5894811d9f2377'', NOW(3),
          ''20260727180000_purchase_multi_unit_uom'', NULL, NULL, NOW(3), 1
   FROM DUAL
   WHERE NOT EXISTS (
     SELECT 1 FROM `_prisma_migrations`
     WHERE `migration_name` = ''20260727180000_purchase_multi_unit_uom''
   )'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT 1',
  'INSERT INTO `_prisma_migrations`
    (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
   SELECT UUID(), ''a04bb9ba14e8b81df944ede1bf3c23a4d503915d10274e52118d1854a9fa57ae'', NOW(3),
          ''20260728140000_grn_receiving_tolerance'', NULL, NULL, NOW(3), 1
   FROM DUAL
   WHERE NOT EXISTS (
     SELECT 1 FROM `_prisma_migrations`
     WHERE `migration_name` = ''20260728140000_grn_receiving_tolerance''
   )'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT 1',
  'INSERT INTO `_prisma_migrations`
    (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
   SELECT UUID(), ''824f62ba5981258df5ef3be4daa70dd577aedb2e4744107b4ac09371dd26c59d'', NOW(3),
          ''20260730110000_item_master_image_url'', NULL, NULL, NOW(3), 1
   FROM DUAL
   WHERE NOT EXISTS (
     SELECT 1 FROM `_prisma_migrations`
     WHERE `migration_name` = ''20260730110000_item_master_image_url''
   )'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Verify: every column Prisma expects on MasterItem --- */
SELECT
  need.column_name,
  CASE WHEN c.COLUMN_NAME IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'batchTracked' AS column_name
  UNION ALL SELECT 'serialTracked'
  UNION ALL SELECT 'defaultFulfilmentMethod'
  UNION ALL SELECT 'salesDescription'
  UNION ALL SELECT 'salesUomId'
  UNION ALL SELECT 'defaultSalesRate'
  UNION ALL SELECT 'salesLeadDays'
  UNION ALL SELECT 'salesAllowed'
  UNION ALL SELECT 'productionAllowed'
  UNION ALL SELECT 'uomConversionFactor'
  UNION ALL SELECT 'receivingTolerancePercentage'
  UNION ALL SELECT 'imageUrl'
) AS need
LEFT JOIN information_schema.COLUMNS AS c
  ON c.TABLE_SCHEMA = @db
 AND c.TABLE_NAME = 'master_items'
 AND c.COLUMN_NAME = need.column_name
ORDER BY status DESC, column_name;

SET @sql := IF(
  @hasPrismaMigrations = 1,
  'SELECT migration_name, finished_at FROM `_prisma_migrations`
   WHERE migration_name IN (
     ''20260722033000_inventory_stock_status_batch_serial'',
     ''20260723210000_master_item_sales_fields'',
     ''20260727180000_purchase_multi_unit_uom'',
     ''20260728140000_grn_receiving_tolerance'',
     ''20260730110000_item_master_image_url''
   )
   ORDER BY migration_name',
  'SELECT ''(no _prisma_migrations)'' AS migration_name, NULL AS finished_at'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
