/* =========================================================
   MANUAL REPAIR — PO quick-line / T&C column camelCase
   File: repair-po-quick-line-terms-camelcase.sql
   Migration: 20260806130000_po_quick_line_terms_camelcase
   (fixes snake_case from 20260806120000_po_quick_line_terms)

   Prefer: npm run db:migrate:deploy  (or prisma migrate deploy)

   Use this only when migrate deploy cannot run (e.g. phpMyAdmin),
   then mark applied:
     prisma migrate resolve --applied 20260806130000_po_quick_line_terms_camelcase

   Idempotent: renames only if snake_case column exists and camelCase does not.
   Safe for DBs already hand-fixed to camelCase.
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'po_quick_line_terms_camelcase' AS script;
SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='payment_term_id')
    AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='paymentTermId'),
    'ALTER TABLE `purchase_orders` RENAME COLUMN `payment_term_id` TO `paymentTermId`',
    'SELECT ''OK skip paymentTermId'' AS msg'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='delivery_term_id')
    AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryTermId'),
    'ALTER TABLE `purchase_orders` RENAME COLUMN `delivery_term_id` TO `deliveryTermId`',
    'SELECT ''OK skip deliveryTermId'' AS msg'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='terms_and_conditions')
    AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='termsAndConditions'),
    'ALTER TABLE `purchase_orders` RENAME COLUMN `terms_and_conditions` TO `termsAndConditions`',
    'SELECT ''OK skip termsAndConditions'' AS msg'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='line_type')
    AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='lineType'),
    'ALTER TABLE `purchase_order_lines` RENAME COLUMN `line_type` TO `lineType`',
    'SELECT ''OK skip lineType'' AS msg'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Verify */
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='paymentTermId') AS paymentTermId,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='deliveryTermId') AS deliveryTermId,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='termsAndConditions') AS termsAndConditions,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='lineType') AS lineType,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='payment_term_id') AS leftover_payment_term_id,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_lines' AND COLUMN_NAME='line_type') AS leftover_line_type;
