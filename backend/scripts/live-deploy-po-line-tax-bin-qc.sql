/* =========================================================
   LIVE DEPLOY — PO line tax / bin / QC snapshots
   Migration: 20260730100000_po_line_tax_bin_qc_snapshots
   Fixes Prisma P2022 on PurchaseOrder / PurchaseApproval
   (API loads PO lines with binId, gstGroupId, hsnId, qcRequiredSnapshot)

   Idempotent — safe to re-run. Run in phpMyAdmin or mysql CLI.
   Change USE database name if not using default from connection.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'po_line_tax_bin_qc' AS script;
SET @db := DATABASE();

/* --- Columns (skip if already exist) --- */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines' AND COLUMN_NAME = 'binId'
  ),
  'SELECT ''OK purchase_order_lines tax/bin/qc columns'' AS msg',
  'ALTER TABLE `purchase_order_lines`
     ADD COLUMN `gstGroupId` VARCHAR(191) NULL,
     ADD COLUMN `hsnId` VARCHAR(191) NULL,
     ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '''',
     ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''',
     ADD COLUMN `binId` VARCHAR(191) NULL,
     ADD COLUMN `qcRequiredSnapshot` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `qualityTestGroupCodeSnapshot` VARCHAR(32) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Indexes (ignore duplicate name errors if re-run) --- */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND INDEX_NAME = 'purchase_order_lines_tenantId_gstGroupId_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `purchase_order_lines_tenantId_gstGroupId_idx` ON `purchase_order_lines`(`tenantId`, `gstGroupId`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND INDEX_NAME = 'purchase_order_lines_tenantId_hsnId_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `purchase_order_lines_tenantId_hsnId_idx` ON `purchase_order_lines`(`tenantId`, `hsnId`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND INDEX_NAME = 'purchase_order_lines_tenantId_binId_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `purchase_order_lines_tenantId_binId_idx` ON `purchase_order_lines`(`tenantId`, `binId`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Foreign keys (optional; skip if constraint already exists) --- */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND CONSTRAINT_NAME = 'purchase_order_lines_gstGroupId_fkey'
  ),
  'SELECT 1',
  'ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_gstGroupId_fkey`
     FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND CONSTRAINT_NAME = 'purchase_order_lines_hsnId_fkey'
  ),
  'SELECT 1',
  'ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_hsnId_fkey`
     FOREIGN KEY (`hsnId`) REFERENCES `master_hsn_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines'
      AND CONSTRAINT_NAME = 'purchase_order_lines_binId_fkey'
  ),
  'SELECT 1',
  'ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_binId_fkey`
     FOREIGN KEY (`binId`) REFERENCES `master_bins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Mark Prisma migration applied (optional — skip if _prisma_migrations missing) --- */
SET @hasPrismaMigrations := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = '_prisma_migrations'
);

SET @sql := IF(
  @hasPrismaMigrations = 0,
  'SELECT ''SKIP: _prisma_migrations table not in this database — columns still applied; run db:deploy later if needed'' AS prisma_note',
  IF(
    EXISTS(SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = ''20260730100000_po_line_tax_bin_qc_snapshots''),
    'SELECT ''OK migration already recorded'' AS prisma_note',
    'INSERT INTO `_prisma_migrations`
      (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
     VALUES
      (UUID(), ''1acf05cfcf520d616ba19361f095b35762f606a12f8ed6b62ad82a31242ae718'', NOW(3),
       ''20260730100000_po_line_tax_bin_qc_snapshots'', NULL, NULL, NOW(3), 1)'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* --- Verify --- */
SELECT COLUMN_NAME, 'OK' AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_order_lines'
  AND COLUMN_NAME IN (
    'binId', 'gstGroupId', 'hsnId', 'qcRequiredSnapshot',
    'hsnCodeSnapshot', 'gstGroupCodeSnapshot', 'qualityTestGroupCodeSnapshot'
  )
ORDER BY COLUMN_NAME;

SET @sql := IF(
  @hasPrismaMigrations = 1,
  'SELECT migration_name, finished_at FROM `_prisma_migrations` WHERE migration_name = ''20260730100000_po_line_tax_bin_qc_snapshots''',
  'SELECT ''(no _prisma_migrations in this database)'' AS migration_name, NULL AS finished_at'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
