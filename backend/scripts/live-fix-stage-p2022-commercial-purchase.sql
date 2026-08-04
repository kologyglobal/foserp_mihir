/* =========================================================
   LIVE FIX — Stage P2022 missing columns
   Database: u233611619_foserp (stageapi.dhurandharcrm.com)

   Fixes:
   - crm_tax_invoices.accountingStatus (+ AR bridge cols)
   - purchase_requisitions.sourceType (+ maintenance PR trace cols)
   - app_notifications (if still missing from earlier P2021)
   - crm_quotation_documents order adjustment cols (if missing)
   - goods_receipts / goods_receipt_lines GRN tolerance + UOM cols (purchase/grns 500)

   Run in phpMyAdmin → select DB → SQL tab → paste all → Go.
   Safe to re-run (idempotent).
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at;
SET @db := DATABASE();

/* ── Helper: add column only when missing ── */
/* crm_tax_invoices.accountingStatus (20260730160000_crm_tax_invoice_ar_bridge) */

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_tax_invoices' AND COLUMN_NAME = 'accountingStatus'
  ),
  'SELECT ''OK crm_tax_invoices.accountingStatus'' AS msg',
  'ALTER TABLE `crm_tax_invoices`
     ADD COLUMN `accountingStatus` ENUM(''none'', ''pending_review'', ''converted'', ''rejected'') NOT NULL DEFAULT ''none'''
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='salesInvoiceId'),
  'SELECT ''OK crm_tax_invoices.salesInvoiceId'' AS msg',
  'ALTER TABLE `crm_tax_invoices` ADD COLUMN `salesInvoiceId` VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='salesInvoiceNumber'),
  'SELECT ''OK crm_tax_invoices.salesInvoiceNumber'' AS msg',
  'ALTER TABLE `crm_tax_invoices` ADD COLUMN `salesInvoiceNumber` VARCHAR(64) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='accountingSubmittedAt'),
  'SELECT ''OK crm_tax_invoices.accountingSubmittedAt'' AS msg',
  'ALTER TABLE `crm_tax_invoices` ADD COLUMN `accountingSubmittedAt` DATETIME(3) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='accountingConvertedAt'),
  'SELECT ''OK crm_tax_invoices.accountingConvertedAt'' AS msg',
  'ALTER TABLE `crm_tax_invoices` ADD COLUMN `accountingConvertedAt` DATETIME(3) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='createdByNameSnapshot'),
  'SELECT ''OK crm_tax_invoices.createdByNameSnapshot'' AS msg',
  'ALTER TABLE `crm_tax_invoices` ADD COLUMN `createdByNameSnapshot` VARCHAR(200) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND INDEX_NAME='crm_tax_invoices_tenantId_accountingStatus_idx'),
  'SELECT ''OK idx accountingStatus'' AS msg',
  'CREATE INDEX `crm_tax_invoices_tenantId_accountingStatus_idx` ON `crm_tax_invoices`(`tenantId`, `accountingStatus`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND INDEX_NAME='crm_tax_invoices_tenantId_salesInvoiceId_key'),
  'SELECT ''OK uq salesInvoiceId'' AS msg',
  'CREATE UNIQUE INDEX `crm_tax_invoices_tenantId_salesInvoiceId_key` ON `crm_tax_invoices`(`tenantId`, `salesInvoiceId`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `crm_tax_invoices`
SET
  `accountingStatus` = 'pending_review',
  `accountingSubmittedAt` = COALESCE(`postedAt`, `createdAt`)
WHERE `deletedAt` IS NULL
  AND `status` IN ('posted', 'partially_paid', 'paid')
  AND (`salesInvoiceId` IS NULL OR `salesInvoiceId` = '')
  AND `accountingStatus` = 'none';

/* purchase_requisitions.sourceType (20260730200000_maintenance_v11_machine_health) */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceType'),
  'SELECT ''OK purchase_requisitions.sourceType'' AS msg',
  'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceType` VARCHAR(40) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceId'),
  'SELECT ''OK purchase_requisitions.sourceId'' AS msg',
  'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceId` VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceDocumentNumber'),
  'SELECT ''OK purchase_requisitions.sourceDocumentNumber'' AS msg',
  'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceDocumentNumber` VARCHAR(64) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND INDEX_NAME='purchase_requisitions_tenantId_sourceType_sourceId_idx'),
  'SELECT ''OK idx pr source'' AS msg',
  'CREATE INDEX `purchase_requisitions_tenantId_sourceType_sourceId_idx` ON `purchase_requisitions` (`tenantId`, `sourceType`, `sourceId`)'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* app_notifications (20260803100000_crm_notifications) — skip if table exists */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='app_notifications'),
  'SELECT ''OK app_notifications table'' AS msg',
  'CREATE TABLE `app_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NOT NULL,
    `category` ENUM(''ASSIGNMENT'', ''FOLLOW_UP'', ''ACTIVITY'', ''MEETING'', ''OPPORTUNITY'', ''QUOTATION'', ''SALES_ORDER'', ''APPROVAL'', ''PROSPECT_REPLY'', ''DATA_QUALITY'', ''RISK'', ''INTEGRATION'') NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `priority` ENUM(''CRITICAL'', ''HIGH'', ''NORMAL'', ''LOW'', ''POSITIVE'') NOT NULL DEFAULT ''NORMAL'',
    `title` VARCHAR(300) NOT NULL,
    `message` TEXT NOT NULL,
    `entityType` VARCHAR(64) NULL,
    `entityId` VARCHAR(191) NULL,
    `entityCode` VARCHAR(64) NULL,
    `entityName` VARCHAR(300) NULL,
    `actionUrl` VARCHAR(500) NULL,
    `primaryAction` VARCHAR(64) NULL,
    `secondaryAction` VARCHAR(64) NULL,
    `status` ENUM(''UNREAD'', ''READ'', ''RESOLVED'', ''SNOOZED'', ''DISMISSED'') NOT NULL DEFAULT ''UNREAD'',
    `readAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `snoozedUntil` DATETIME(3) NULL,
    `sourceEventId` VARCHAR(120) NULL,
    `deduplicationKey` VARCHAR(255) NULL,
    `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    INDEX `app_notifications_tenantId_recipientUserId_status_idx`(`tenantId`, `recipientUserId`, `status`),
    INDEX `app_notifications_tenantId_recipientUserId_createdAt_idx`(`tenantId`, `recipientUserId`, `createdAt`),
    INDEX `app_notifications_tenantId_priority_createdAt_idx`(`tenantId`, `priority`, `createdAt`),
    INDEX `app_notifications_tenantId_entityType_entityId_idx`(`tenantId`, `entityType`, `entityId`),
    INDEX `app_notifications_tenantId_deduplicationKey_idx`(`tenantId`, `deduplicationKey`),
    INDEX `app_notifications_tenantId_type_status_idx`(`tenantId`, `type`, `status`),
    INDEX `app_notifications_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* quotation order adjustments (20260803120000) — orderDiscountCalcType */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_quotation_documents' AND COLUMN_NAME='orderDiscountCalcType'),
  'SELECT ''OK orderDiscountCalcType'' AS msg',
  'ALTER TABLE `crm_quotation_documents`
     ADD COLUMN `orderDiscountCalcType` VARCHAR(16) NOT NULL DEFAULT ''FLAT'',
     ADD COLUMN `orderDiscountValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `orderDiscountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
     ADD COLUMN `freightCalcType` VARCHAR(16) NOT NULL DEFAULT ''FLAT'',
     ADD COLUMN `freightValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `freightIsTaxable` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `freightTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `freightTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
     ADD COLUMN `installationCalcType` VARCHAR(16) NOT NULL DEFAULT ''FLAT'',
     ADD COLUMN `installationValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `installationIsTaxable` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `installationTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `installationTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
     ADD COLUMN `customChargesCalcType` VARCHAR(16) NOT NULL DEFAULT ''FLAT'',
     ADD COLUMN `customChargesValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `customChargesIsTaxable` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `customChargesTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `customChargesTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `crm_quotation_documents`
SET
  `freightValue` = `freightAmount`,
  `installationValue` = `installationAmount`,
  `customChargesValue` = `customCharges`
WHERE `deletedAt` IS NULL
  AND EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'crm_quotation_documents' AND COLUMN_NAME = 'freightValue'
  );

/* ═══ GRN list / purchase/grns (20260728140000 + 20260727180000 + 20260801100000) ═══ */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts'),
  'SELECT ''OK goods_receipts table'' AS msg',
  'SELECT ''ERROR: goods_receipts table missing — run full migrate deploy'' AS msg'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired'),
  'SELECT ''OK goods_receipts.toleranceApprovalRequired'' AS msg',
  'ALTER TABLE `goods_receipts`
     ADD COLUMN `toleranceApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `toleranceApprovedAt` DATETIME(3) NULL,
     ADD COLUMN `toleranceApprovedById` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* goods_receipts.status must include PENDING_TOLERANCE_APPROVAL */
ALTER TABLE `goods_receipts`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'PENDING_TOLERANCE_APPROVAL',
    'SUBMITTED',
    'RECEIVING_COMPLETED',
    'QC_PENDING',
    'PARTIALLY_ACCEPTED',
    'FULLY_ACCEPTED',
    'INVENTORY_POSTED',
    'CANCELLED',
    'REVERSED',
    'CLOSED'
  ) NOT NULL DEFAULT 'DRAFT';

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus'),
  'SELECT ''OK goods_receipt_lines.toleranceStatus'' AS msg',
  'ALTER TABLE `goods_receipt_lines`
     ADD COLUMN `tolerancePercentage` DECIMAL(5, 2) NOT NULL DEFAULT 0,
     ADD COLUMN `variancePercentage` DECIMAL(9, 4) NULL,
     ADD COLUMN `toleranceStatus` ENUM(''NOT_RECEIVED'', ''PARTIAL'', ''EXACT'', ''EXCESS_WITHIN_TOLERANCE'', ''EXCESS_OUTSIDE_TOLERANCE'') NOT NULL DEFAULT ''EXACT'',
     ADD COLUMN `closeOpenQuantity` BOOLEAN NOT NULL DEFAULT false'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='orderedUomQuantity'),
  'SELECT ''OK goods_receipt_lines UOM cols'' AS msg',
  'ALTER TABLE `goods_receipt_lines`
     ADD COLUMN `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1,
     ADD COLUMN `unitCostPrimary` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `orderedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `receivedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `acceptedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
     ADD COLUMN `rejectedUomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `goods_receipt_lines`
SET
  `uomConversionFactor` = 1,
  `unitCostPrimary` = `rate`,
  `orderedUomQuantity` = `orderedQuantity`,
  `receivedUomQuantity` = `receivedQuantity`,
  `acceptedUomQuantity` = `acceptedQuantity`,
  `rejectedUomQuantity` = `rejectedQuantity`
WHERE EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='orderedUomQuantity'
);

/* receiving tolerance master + line snapshots (20260801100000) */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_receiving_tolerances'),
  'SELECT ''OK master_receiving_tolerances'' AS msg',
  'CREATE TABLE `master_receiving_tolerances` (
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
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

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

/* Migrate legacy toleranceStatus enum values (20260728140000 → 20260801100000).
   Without this step Prisma throws on read → GET /purchase/grns returns 500 code null. */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus'),
  'ALTER TABLE `goods_receipt_lines`
     MODIFY COLUMN `toleranceStatus` ENUM(
       ''OK'', ''PARTIAL'', ''NOT_RECEIVED'', ''SHORT_OUTSIDE'', ''EXCESS_WITHIN'', ''EXCESS_OUTSIDE'',
       ''EXACT'', ''EXCESS_WITHIN_TOLERANCE'', ''EXCESS_OUTSIDE_TOLERANCE''
     ) NOT NULL DEFAULT ''EXACT''',
  'SELECT ''SKIP toleranceStatus — column missing'' AS msg'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXACT' WHERE `toleranceStatus` = 'OK';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_WITHIN_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_WITHIN';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_OUTSIDE';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'PARTIAL' WHERE `toleranceStatus` = 'SHORT_OUTSIDE';

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `approvalReasons` = JSON_ARRAY() WHERE `approvalReasons` IS NULL;

UPDATE `goods_receipt_lines`
SET `requiresApproval` = true,
    `approvalReasons` = JSON_ARRAY('UNIT_OVER_TOLERANCE')
WHERE `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE'
  AND EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='requiresApproval'
  );

UPDATE `goods_receipt_lines`
SET `shortCloseRequested` = `closeOpenQuantity`
WHERE `closeOpenQuantity` = true
  AND EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='shortCloseRequested'
  );

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='inventoryLotId'),
  'SELECT ''OK inventoryLotId'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `inventoryLotId` VARCHAR(191) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Mark migrations applied (so future prisma migrate deploy skips them) */

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260730160000_crm_tax_invoice_ar_bridge', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260730160000_crm_tax_invoice_ar_bridge');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260730200000_maintenance_v11_machine_health', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260730200000_maintenance_v11_machine_health');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260803100000_crm_notifications', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260803100000_crm_notifications');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260803120000_quotation_order_adjustments', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260803120000_quotation_order_adjustments');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260728140000_grn_receiving_tolerance', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260728140000_grn_receiving_tolerance');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260727180000_purchase_multi_unit_uom', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260727180000_purchase_multi_unit_uom');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT UUID(), '', NOW(3), '20260801100000_receiving_tolerance_master', NULL, NULL, NOW(3), 1
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260801100000_receiving_tolerance_master');

/* Verify */
SELECT 'crm_tax_invoices.accountingStatus' AS check_item,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='crm_tax_invoices' AND COLUMN_NAME='accountingStatus'
  ) THEN 'OK' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'purchase_requisitions.sourceType',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceType'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'goods_receipt_lines.requiresApproval',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='requiresApproval'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'goods_receipt_lines.receivingToleranceIdSnapshot',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='receivingToleranceIdSnapshot'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'goods_receipts.toleranceApprovalRequired',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'master_receiving_tolerances table',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_receiving_tolerances'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'legacy_toleranceStatus_rows (must be 0)',
  CAST((
    SELECT COUNT(*) FROM `goods_receipt_lines`
    WHERE `toleranceStatus` IN ('OK', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE')
  ) AS CHAR);
