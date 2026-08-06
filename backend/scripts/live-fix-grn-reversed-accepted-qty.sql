/* =========================================================
   LIVE FIX — Prisma P2022 on GoodsReceipt / GRN (partial reverse cols)

   Migration: 20260806110000_grn_line_partial_reverse

   Adds ALL four columns on goods_receipt_lines:
     - reversedQuantity
     - reversedAcceptedQuantity
     - reversedRejectedQuantity
     - reversedAt

   If you only added reversedAcceptedQuantity manually, you still need
   the other three — P2022 will move to the next missing column.

   Run in phpMyAdmin on stage/live DB (e.g. u233611619_foserp).
   Safe to re-run (idempotent).
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := DATABASE();

/* ── 1) Audit — expect 4 rows when OK ── */
SELECT c.col AS column_name,
  CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  SELECT 'reversedQuantity' AS col
  UNION ALL SELECT 'reversedAcceptedQuantity'
  UNION ALL SELECT 'reversedRejectedQuantity'
  UNION ALL SELECT 'reversedAt'
) c
LEFT JOIN information_schema.COLUMNS ic
  ON ic.TABLE_SCHEMA = @db
 AND ic.TABLE_NAME = 'goods_receipt_lines'
 AND ic.COLUMN_NAME = c.col
ORDER BY c.col;

/* ── 2) Add each column if missing ── */

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='reversedQuantity'),
  'SELECT ''OK reversedQuantity'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `reversedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='reversedAcceptedQuantity'),
  'SELECT ''OK reversedAcceptedQuantity'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `reversedAcceptedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='reversedRejectedQuantity'),
  'SELECT ''OK reversedRejectedQuantity'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `reversedRejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='goods_receipt_lines' AND COLUMN_NAME='reversedAt'),
  'SELECT ''OK reversedAt'' AS msg',
  'ALTER TABLE `goods_receipt_lines` ADD COLUMN `reversedAt` DATETIME(3) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 3) Verify ── */
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'goods_receipt_lines'
  AND COLUMN_NAME IN (
    'reversedQuantity',
    'reversedAcceptedQuantity',
    'reversedRejectedQuantity',
    'reversedAt'
  )
ORDER BY COLUMN_NAME;

SELECT 'GRN partial-reverse P2022 fix done — retry GRN API' AS status;
