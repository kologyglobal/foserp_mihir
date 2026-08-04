  /* =========================================================
    LIVE FIX — GET /purchase/grns → 500 (code null)
    Root cause: stage DB missing GRN columns and/or legacy
    goods_receipt_lines.toleranceStatus enum values (OK,
    SHORT_OUTSIDE, EXCESS_WITHIN, EXCESS_OUTSIDE) that Prisma
    cannot deserialize.
    Run in phpMyAdmin on u233611619_foserp (or your stage DB).
    Idempotent — safe to re-run.
    ========================================================= */

  SELECT DATABASE() AS current_db, NOW() AS ran_at, 'live-fix-grn-list-500' AS script;
  SET @db := DATABASE();

  /* ── Diagnostic: legacy enum values still in data ── */
  SELECT 'legacy_toleranceStatus_rows' AS check_item, COUNT(*) AS cnt
  FROM `goods_receipt_lines`
  WHERE `toleranceStatus` IN ('OK', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE')
  UNION ALL
  SELECT 'goods_receipt_lines.missing_requiresApproval',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='requiresApproval'
    ) THEN 0 ELSE 1 END
  UNION ALL
  SELECT 'goods_receipt_lines.missing_orderedUomQuantity',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='orderedUomQuantity'
    ) THEN 0 ELSE 1 END
  UNION ALL
  SELECT 'goods_receipts.missing_toleranceApprovalRequired',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired'
    ) THEN 0 ELSE 1 END;

  /* ── goods_receipts header columns ── */
  SET @sql := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipts' AND COLUMN_NAME='toleranceApprovalRequired'),
    'SELECT ''OK goods_receipts.toleranceApprovalRequired'' AS msg',
    'ALTER TABLE `goods_receipts`
      ADD COLUMN `toleranceApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN `toleranceApprovedAt` DATETIME(3) NULL,
      ADD COLUMN `toleranceApprovedById` VARCHAR(36) NULL'
  ));
  PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

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

  /* ── goods_receipt_lines: tolerance + UOM columns ── */
  SET @sql := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus'),
    'SELECT ''OK goods_receipt_lines.toleranceStatus'' AS msg',
    'ALTER TABLE `goods_receipt_lines`
      ADD COLUMN `tolerancePercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
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

  SET @sql := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='inventoryLotId'),
    'SELECT ''OK inventoryLotId'' AS msg',
    'ALTER TABLE `goods_receipt_lines` ADD COLUMN `inventoryLotId` VARCHAR(191) NULL'
  ));
  PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

  /* ── Critical: migrate legacy toleranceStatus enum values ── */
  SET @sql := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='toleranceStatus'),
    'ALTER TABLE `goods_receipt_lines`
      MODIFY COLUMN `toleranceStatus` ENUM(
        ''OK'', ''PARTIAL'', ''NOT_RECEIVED'', ''SHORT_OUTSIDE'', ''EXCESS_WITHIN'', ''EXCESS_OUTSIDE'',
        ''EXACT'', ''EXCESS_WITHIN_TOLERANCE'', ''EXCESS_OUTSIDE_TOLERANCE''
      ) NOT NULL DEFAULT ''EXACT''',
    'SELECT ''SKIP toleranceStatus enum expand'' AS msg'
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
  WHERE `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE';

  UPDATE `goods_receipt_lines`
  SET `shortCloseRequested` = `closeOpenQuantity`
  WHERE `closeOpenQuantity` = true;

  /* ── Post-fix verification ── */
  SELECT 'legacy_toleranceStatus_rows_after_fix' AS check_item, COUNT(*) AS cnt
  FROM `goods_receipt_lines`
  WHERE `toleranceStatus` IN ('OK', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE')
  UNION ALL
  SELECT 'goods_receipt_lines.requiresApproval',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='requiresApproval'
    ) THEN 1 ELSE 0 END
  UNION ALL
  SELECT 'goods_receipt_lines.orderedUomQuantity',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='orderedUomQuantity'
    ) THEN 1 ELSE 0 END;

  SELECT 'GRN list fix complete — retry GET /purchase/grns' AS status;
