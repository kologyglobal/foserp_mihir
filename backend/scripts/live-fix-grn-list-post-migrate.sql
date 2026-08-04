/* =========================================================
   POST-MIGRATE FIX — GET /purchase/grns → 500
   Run in phpMyAdmin on u233611619_foserp after migrate deploy.
   Hostinger-safe: plain SQL, no information_schema PREPARE.
   ========================================================= */

USE `u233611619_foserp`;

/* ── 1) DIAGNOSTIC — show ACTUAL stored values (invalid enums show as blank) ── */
SELECT CAST(`toleranceStatus` AS CHAR(64)) AS toleranceStatus_raw, COUNT(*) AS cnt
FROM `goods_receipt_lines`
GROUP BY CAST(`toleranceStatus` AS CHAR(64));

SELECT 'legacy_toleranceStatus' AS issue, CAST(`toleranceStatus` AS CHAR(64)) AS val, COUNT(*) AS cnt
FROM `goods_receipt_lines`
WHERE CAST(`toleranceStatus` AS CHAR(64)) NOT IN (
  'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
)
GROUP BY CAST(`toleranceStatus` AS CHAR(64));

SELECT 'legacy_grn_status' AS issue, status AS val, COUNT(*) AS cnt
FROM `goods_receipts`
WHERE `status` NOT IN (
  'DRAFT', 'PENDING_TOLERANCE_APPROVAL', 'SUBMITTED', 'RECEIVING_COMPLETED',
  'QC_PENDING', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED', 'INVENTORY_POSTED',
  'CANCELLED', 'REVERSED', 'CLOSED'
)
GROUP BY status;

SELECT 'null_approvalReasons' AS issue, COUNT(*) AS cnt
FROM `goods_receipt_lines`
WHERE `approvalReasons` IS NULL;

/* ── 2) FIX legacy toleranceStatus (Prisma cannot read OK/EXCESS_WITHIN etc.) ── */

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'OK', 'PARTIAL', 'NOT_RECEIVED', 'SHORT_OUTSIDE', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE',
    'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXACT' WHERE `toleranceStatus` = 'OK';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_WITHIN_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_WITHIN';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'EXCESS_OUTSIDE_TOLERANCE' WHERE `toleranceStatus` = 'EXCESS_OUTSIDE';
UPDATE `goods_receipt_lines` SET `toleranceStatus` = 'PARTIAL' WHERE `toleranceStatus` = 'SHORT_OUTSIDE';

/* Force-fix blank/invalid enum leftovers (MySQL stores bad enums as '') */
UPDATE `goods_receipt_lines`
SET `toleranceStatus` = 'EXACT'
WHERE CAST(`toleranceStatus` AS CHAR(64)) NOT IN (
  'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
);

ALTER TABLE `goods_receipt_lines`
  MODIFY COLUMN `toleranceStatus` ENUM(
    'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
  ) NOT NULL DEFAULT 'EXACT';

UPDATE `goods_receipt_lines` SET `approvalReasons` = JSON_ARRAY() WHERE `approvalReasons` IS NULL;

UPDATE `goods_receipt_lines`
SET `shortCloseRequested` = true
WHERE `closeOpenQuantity` = true AND (`shortCloseRequested` IS NULL OR `shortCloseRequested` = false);

/* ── 3) VERIFY ── */
SELECT 'legacy_toleranceStatus_after' AS check_item, COUNT(*) AS cnt
FROM `goods_receipt_lines`
WHERE CAST(`toleranceStatus` AS CHAR(64)) NOT IN (
  'NOT_RECEIVED', 'PARTIAL', 'EXACT', 'EXCESS_WITHIN_TOLERANCE', 'EXCESS_OUTSIDE_TOLERANCE'
);

SELECT 'GRN post-migrate fix done — retry GET /purchase/grns' AS status;
