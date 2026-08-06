/* =========================================================
   LIVE FIX — POST /purchase/requisitions/:id/approve → 500
   Database: u233611619_foserp (stageapi.dhurandharcrm.com)

   Typical causes (same pattern as GRN/PO 500s):
   1) Missing table purchase_approver_limits (approve-only query)
   2) Missing purchase_planning_rows.allocatedQuantity / orderedQuantity
      (final approve when rfqRequired = false → planning sync)
   3) Missing GST snapshot cols on purchase_requisition_lines
   4) Missing purchase_requisition_lines.orderedQuantity

   Run in phpMyAdmin AFTER selecting u233611619_foserp.
   Idempotent — safe to re-run (skips existing objects).

   Then: Hostinger Stop → Start (prisma generate on boot) or redeploy.
   Probe: PR_ID=… TENANT_SLUG=vasant-trailers npx tsx scripts/probe-pr-approve-live.ts
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'live-fix-pr-approve-500' AS script;
SET @db := DATABASE();

/* ── 1) AUDIT — missing columns (expect 0 rows when OK) ── */

SELECT 'purchase_requisition_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'orderedQuantity' AS col UNION ALL SELECT 'hsnId' UNION ALL SELECT 'gstGroupId'
  UNION ALL SELECT 'hsnCodeSnapshot' UNION ALL SELECT 'gstGroupCodeSnapshot'
  UNION ALL SELECT 'gstRatePctSnapshot' UNION ALL SELECT 'cgstRateSnapshot'
  UNION ALL SELECT 'sgstRateSnapshot' UNION ALL SELECT 'igstRateSnapshot'
  UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_lines' AND COLUMN_NAME = c.col
);

SELECT 'purchase_planning_rows' AS tbl, c.col AS missing_column
FROM (
  SELECT 'allocatedQuantity' AS col UNION ALL SELECT 'orderedQuantity'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_planning_rows' AND COLUMN_NAME = c.col
);

SELECT 'purchase_requisitions' AS tbl, c.col AS missing_column
FROM (
  SELECT 'revisionNo' AS col UNION ALL SELECT 'sourceType' UNION ALL SELECT 'sourceId'
  UNION ALL SELECT 'sourceDocumentNumber'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisitions' AND COLUMN_NAME = c.col
);

SELECT 'missing_table' AS check_item, t.tbl AS missing_table
FROM (
  SELECT 'purchase_approver_limits' AS tbl UNION ALL SELECT 'purchase_approvals'
  UNION ALL SELECT 'purchase_status_histories' UNION ALL SELECT 'purchase_planning_rows'
) t
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = t.tbl
);

/* ── 2) FIX — purchase_approver_limits (migration 20260727180000) ── */

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approver_limits'),
    'SELECT ''OK purchase_approver_limits table'' AS msg',
    'CREATE TABLE `purchase_approver_limits` (
      `id` VARCHAR(191) NOT NULL,
      `tenantId` VARCHAR(191) NOT NULL,
      `purchaseSettingsId` VARCHAR(191) NOT NULL,
      `userId` VARCHAR(191) NOT NULL,
      `maxAmountInr` DECIMAL(18, 2) NOT NULL,
      `documentType` ENUM(''ALL'', ''PURCHASE_REQUISITION'', ''PURCHASE_ORDER'') NOT NULL DEFAULT ''ALL'',
      `isActive` BOOLEAN NOT NULL DEFAULT true,
      `sortOrder` INT NOT NULL DEFAULT 1,
      `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      `updatedAt` DATETIME(3) NOT NULL,
      UNIQUE INDEX `purchase_approver_limits_settings_user_doc_uidx`(`purchaseSettingsId`, `userId`, `documentType`),
      INDEX `purchase_approver_limits_tenantId_idx`(`tenantId`),
      INDEX `purchase_approver_limits_tenantId_userId_idx`(`tenantId`, `userId`),
      PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approver_limits' AND CONSTRAINT_NAME='purchase_approver_limits_tenantId_fkey'),
    'SELECT ''OK FK tenantId'' AS msg',
    'ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approver_limits' AND CONSTRAINT_NAME='purchase_approver_limits_purchaseSettingsId_fkey'),
    'SELECT ''OK FK purchaseSettingsId'' AS msg',
    'ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_purchaseSettingsId_fkey` FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approver_limits' AND CONSTRAINT_NAME='purchase_approver_limits_userId_fkey'),
    'SELECT ''OK FK userId'' AS msg',
    'ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 3) FIX — PR line orderedQuantity + GST snapshots ── */

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisition_lines' AND COLUMN_NAME='orderedQuantity'),
    'SELECT ''OK orderedQuantity'' AS msg',
    'ALTER TABLE `purchase_requisition_lines` ADD COLUMN `orderedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisition_lines' AND COLUMN_NAME='hsnId'),
    'SELECT ''OK PR line tax snapshots'' AS msg',
    'ALTER TABLE `purchase_requisition_lines`
      ADD COLUMN `hsnId` VARCHAR(36) NULL,
      ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
      ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '''',
      ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '''',
      ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
      ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
      ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
      ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT ''cgst_sgst'''
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 4) FIX — planning row allocation cols (migration 20260804140000) ── */

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_planning_rows' AND COLUMN_NAME='allocatedQuantity'),
    'SELECT ''OK allocatedQuantity'' AS msg',
    'ALTER TABLE `purchase_planning_rows` ADD COLUMN `allocatedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_planning_rows' AND COLUMN_NAME='orderedQuantity'),
    'SELECT ''OK planning orderedQuantity'' AS msg',
    'ALTER TABLE `purchase_planning_rows` ADD COLUMN `orderedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `purchase_planning_rows`
SET `allocatedQuantity` = `netPurchaseQuantity`
WHERE `allocatedQuantity` = 0 AND `netPurchaseQuantity` > 0;

/* ── 5) FIX — PR header trace / revision cols ── */

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='revisionNo'),
    'SELECT ''OK revisionNo'' AS msg',
    'ALTER TABLE `purchase_requisitions` ADD COLUMN `revisionNo` INT NOT NULL DEFAULT 0'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceType'),
    'SELECT ''OK sourceType'' AS msg',
    'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceType` VARCHAR(40) NULL'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceId'),
    'SELECT ''OK sourceId'' AS msg',
    'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceId` VARCHAR(191) NULL'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisitions' AND COLUMN_NAME='sourceDocumentNumber'),
    'SELECT ''OK sourceDocumentNumber'' AS msg',
    'ALTER TABLE `purchase_requisitions` ADD COLUMN `sourceDocumentNumber` VARCHAR(64) NULL'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 6) VERIFY ── */

SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_approver_limits') AS has_approver_limits_table,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_planning_rows' AND COLUMN_NAME='allocatedQuantity') AS has_allocatedQuantity,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisition_lines' AND COLUMN_NAME='orderedQuantity') AS has_pr_line_orderedQty,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_requisition_lines' AND COLUMN_NAME='hsnId') AS has_pr_line_hsnId;

SELECT id, requisitionNumber, status, rfqRequired, submittedAt, approvedAt
FROM purchase_requisitions
WHERE id = '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba'
LIMIT 1;

SELECT id, level, status, approverRole, approverId, amount
FROM purchase_approvals
WHERE purchaseRequisitionId = '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba'
ORDER BY level, requestedAt;
