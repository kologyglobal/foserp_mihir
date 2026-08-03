/* =========================================================
   LIVE — feature/crm-so-customer360-titles (Hostinger phpMyAdmin)
   IMPORTANT: In phpMyAdmin, click your LIVE database name on the left FIRST
   (must match hPanel env DB_NAME — often u233611619_fos_erp or similar).
   ========================================================= */

/* ── 0) Verify you are on the correct database ── */
SELECT DATABASE() AS current_database;
SHOW COLUMNS FROM `tenants` LIKE 'businessType';
SHOW COLUMNS FROM `tenants` LIKE 'displayTerminology';

SET @db := DATABASE();

/* ── 1) tenants.businessType + displayTerminology (direct ALTER — shows errors clearly) ── */
SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tenants' AND COLUMN_NAME='businessType'),
  'SELECT ''SKIP: tenants.businessType already exists'' AS step1',
  'ALTER TABLE `tenants` ADD COLUMN `businessType` ENUM(''MANUFACTURING'', ''SERVICES'') NOT NULL DEFAULT ''MANUFACTURING'''
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tenants' AND COLUMN_NAME='displayTerminology'),
  'SELECT ''SKIP: tenants.displayTerminology already exists'' AS step2',
  'ALTER TABLE `tenants` ADD COLUMN `displayTerminology` JSON NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `tenants` SET `displayTerminology` = CAST('{}' AS JSON)
WHERE `displayTerminology` IS NULL;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tenants' AND COLUMN_NAME='displayTerminology'
    AND IS_NULLABLE = 'NO'
  ),
  'SELECT ''SKIP: displayTerminology already NOT NULL'' AS step2b',
  'ALTER TABLE `tenants` MODIFY COLUMN `displayTerminology` JSON NOT NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES
(UUID(),'manual-live-repair',NOW(3),'20260727193000_tenant_business_type_services',NULL,NULL,NOW(3),1);

/* ── 2) legal_entities print / bank profile ── */
SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='email'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `email` VARCHAR(255) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='phone'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `phone` VARCHAR(30) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='website'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `website` VARCHAR(255) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankAccountName'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `bankAccountName` VARCHAR(200) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankName'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `bankName` VARCHAR(200) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankAccountNumber'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `bankAccountNumber` VARCHAR(40) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankIfscCode'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `bankIfscCode` VARCHAR(20) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankBranch'),
  'SELECT 1',
  'ALTER TABLE `legal_entities` ADD COLUMN `bankBranch` VARCHAR(200) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES
(UUID(),'manual-live-repair',NOW(3),'20260727210000_legal_entity_print_profile',NULL,NULL,NOW(3),1);

/* ── 3) recurring sales invoice schedules ── */
CREATE TABLE IF NOT EXISTS `recurring_sales_invoice_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `nextInvoiceDate` DATE NOT NULL,
    `invoiceTemplate` JSON NOT NULL,
    `lastGeneratedAt` DATETIME(3) NULL,
    `lastGeneratedForDate` DATE NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    INDEX `recurring_sales_invoice_schedules_tenantId_idx`(`tenantId`),
    INDEX `recur_si_sched_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `recurring_sales_invoice_schedules_nextInvoiceDate_idx`(`nextInvoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_sales_invoice_executions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `invoiceDate` DATE NOT NULL,
    `status` ENUM('SCHEDULED', 'APPROVED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `salesInvoiceId` VARCHAR(191) NULL,
    `failureReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `recurring_sales_invoice_executions_salesInvoiceId_key`(`salesInvoiceId`),
    UNIQUE INDEX `recur_si_exec_due_key`(`scheduleId`, `invoiceDate`),
    INDEX `recurring_sales_invoice_executions_tenantId_idx`(`tenantId`),
    INDEX `recur_si_exec_tenant_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES
(UUID(),'manual-live-repair',NOW(3),'20260728060000_recurring_sales_invoice_schedule',NULL,NULL,NOW(3),1);

/* ── 4) sales_invoices.sourceType + PROFORMA_INVOICE ── */
SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_invoices' AND COLUMN_NAME='sourceType'
      AND COLUMN_TYPE LIKE '%PROFORMA_INVOICE%'
  ),
  'SELECT ''sales_invoices.sourceType already has PROFORMA_INVOICE''',
  'ALTER TABLE `sales_invoices` MODIFY COLUMN `sourceType` ENUM(''DIRECT'', ''SALES_ORDER'', ''OUTBOUND_DISPATCH'', ''PROFORMA_INVOICE'') NOT NULL DEFAULT ''DIRECT'''
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES
(UUID(),'manual-live-repair',NOW(3),'20260728120000_sales_invoice_proforma_source',NULL,NULL,NOW(3),1);

/* ── Kology tenant: SERVICES packaging (safe to re-run) ── */
UPDATE `tenants`
SET `businessType` = 'SERVICES'
WHERE `slug` = 'kology' AND (`businessType` IS NULL OR `businessType` <> 'SERVICES');

SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tenants' AND COLUMN_NAME='businessType') AS tenant_business_type,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='legal_entities' AND COLUMN_NAME='bankIfscCode') AS legal_entity_bank,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='recurring_sales_invoice_schedules') AS recurring_schedules,
  (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_invoices' AND COLUMN_NAME='sourceType' LIMIT 1) AS sales_invoice_source_type;
