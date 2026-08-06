/* =========================================================
   EMERGENCY UNBLOCK — P2022 purchase_orders.paymentTermId / deliveryTermId

   Stale Hostinger Prisma client SELECTs *TermId FK columns; main uses
   paymentTerms / deliveryTerms (varchar). See live-fix-po-stale-term-id-columns.sql
   for the full idempotent script (preferred).

   Quick one-liner for deliveryTermId only (if paymentTermId already exists):
     ALTER TABLE purchase_orders ADD COLUMN deliveryTermId VARCHAR(36) NULL;
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := DATABASE();

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='paymentTermId'),
  'SELECT ''OK paymentTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `paymentTermId` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryTermId'),
  'SELECT ''OK deliveryTermId'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliveryTermId` VARCHAR(36) NULL'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_orders'
  AND COLUMN_NAME IN ('paymentTerms', 'paymentTermId', 'deliveryTerms', 'deliveryTermId')
ORDER BY COLUMN_NAME;

SELECT 'Stale PO term-id columns OK — retry PO list' AS status;
