/* =========================================================
   EMERGENCY UNBLOCK — stale Hostinger Prisma client on purchase_orders

   Symptom: P2022 on paymentTermId, deliveryTermId, etc.
   Current main schema uses paymentTerms / deliveryTerms (varchar text).

   Band-aid: add nullable FK-shaped columns the stale client SELECTs.
   Proper fix: redeploy + hostinger-start runs prisma generate (or SSH:
     cd nodejs && npx prisma generate --schema=./prisma/schema.prisma
     then Stop → Start app in hPanel).

   Run in phpMyAdmin on stage/live DB. Safe to re-run (idempotent).
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := DATABASE();

/* ── Audit ── */
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_orders'
  AND COLUMN_NAME IN ('paymentTerms', 'paymentTermId', 'deliveryTerms', 'deliveryTermId')
ORDER BY COLUMN_NAME;

/* ── paymentTermId ── */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='paymentTermId'),
  'SELECT ''OK paymentTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `paymentTermId` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── deliveryTermId ── */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryTermId'),
  'SELECT ''OK deliveryTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliveryTermId` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── Verify ── */
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_orders'
  AND COLUMN_NAME IN ('paymentTerms', 'paymentTermId', 'deliveryTerms', 'deliveryTermId')
ORDER BY COLUMN_NAME;

SELECT 'Stale PO term-id columns OK — retry PO list; redeploy + restart for durable fix' AS status;
