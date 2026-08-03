/* =========================================================
   LIVE DEPLOY — Receiving Tolerance Master
   File: live-deploy-receiving-tolerance-master.sql
   Migration: 20260801100000_receiving_tolerance_master
   Idempotent — safe to re-run on stage Hostinger DB.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'receiving_tolerance_master' AS script;
SET @db := DATABASE();

/* master_receiving_tolerances table */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_receiving_tolerances'),
  'SELECT ''OK master_receiving_tolerances'' AS msg',
  CONCAT('CREATE TABLE `master_receiving_tolerances` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `percentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM(''ACTIVE'', ''INACTIVE'') NOT NULL DEFAULT ''ACTIVE'',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `master_receiving_tolerances_tenantId_code_key`(`tenantId`, `code`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* master_items columns */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='receivingToleranceId'),
  'SELECT 1',
  'ALTER TABLE `master_items`
    ADD COLUMN `receivingToleranceId` VARCHAR(191) NULL,
    ADD COLUMN `receiptEntryMode` ENUM(''UNIT_ONLY'', ''WEIGHT_ONLY'', ''UNIT_AND_WEIGHT'') NOT NULL DEFAULT ''UNIT_ONLY'',
    ADD COLUMN `conversionCalculationMode` ENUM(''AUTOMATIC'', ''MANUAL'') NOT NULL DEFAULT ''AUTOMATIC'',
    ADD COLUMN `allowManualUnitQuantity` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `allowManualWeightQuantity` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `requireWeightAtReceipt` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `weightUomId` VARCHAR(191) NULL,
    ADD COLUMN `standardWeightPerBaseUnit` DECIMAL(18, 4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* goods_receipt_lines enum + snapshot columns — run migration file sections if missing */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='requiresApproval'),
  'SELECT ''OK goods_receipt_lines snapshots'' AS msg',
  'ALTER TABLE `goods_receipt_lines`
    ADD COLUMN `receivingToleranceIdSnapshot` VARCHAR(36) NULL,
    ADD COLUMN `receivingToleranceCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''',
    ADD COLUMN `receivingToleranceNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '''',
    ADD COLUMN `receivingTolerancePercentageSnapshot` DECIMAL(8, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `maximumAllowedUnitQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `unitVariance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `receivedWeight` DECIMAL(18, 4) NULL,
    ADD COLUMN `expectedWeight` DECIMAL(18, 4) NULL,
    ADD COLUMN `maximumAllowedWeight` DECIMAL(18, 4) NULL,
    ADD COLUMN `weightVariance` DECIMAL(18, 4) NULL,
    ADD COLUMN `weightVariancePercentage` DECIMAL(9, 4) NULL,
    ADD COLUMN `weightConversionRateSnapshot` DECIMAL(18, 4) NULL,
    ADD COLUMN `weightUomIdSnapshot` VARCHAR(36) NULL,
    ADD COLUMN `weightUomCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''',
    ADD COLUMN `manualUnitEntry` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `manualWeightEntry` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `weightToleranceStatus` ENUM(''NOT_APPLICABLE'', ''EXACT'', ''EXCESS_WITHIN_TOLERANCE'', ''EXCESS_OUTSIDE_TOLERANCE'') NOT NULL DEFAULT ''NOT_APPLICABLE'',
    ADD COLUMN `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `approvalReasons` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    ADD COLUMN `shortCloseRequested` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shortCloseReason` TEXT NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Seed system tolerances per tenant */
INSERT INTO master_receiving_tolerances (id, tenantId, code, name, description, percentage, isSystem, status, createdAt, updatedAt)
SELECT UUID(), t.id, v.code, v.name, v.description, v.percentage, true, 'ACTIVE', NOW(3), NOW(3)
FROM tenants t
CROSS JOIN (
  SELECT 'EXACT' AS code, 'Exact receipt' AS name, '0% excess tolerance' AS description, 0 AS percentage
  UNION ALL SELECT 'STD10', 'Standard 10%', '10% excess tolerance', 10
  UNION ALL SELECT 'BULK20', 'Bulk 20%', '20% excess tolerance for bulk materials', 20
) v
WHERE t.deletedAt IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_receiving_tolerances rt
    WHERE rt.tenantId = t.id AND rt.code = v.code AND rt.deletedAt IS NULL
  );

SELECT 'receiving_tolerance_master deploy complete' AS status;
