-- Repair follow-up for 20260806120000_po_quick_line_terms.
-- MariaDB / older MySQL: use CHANGE COLUMN (RENAME COLUMN is MySQL 8+ only).

SET @db := DATABASE();

/* purchase_orders.payment_term_id -> paymentTermId */
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'payment_term_id'
    )
    AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'paymentTermId'
    ),
    'ALTER TABLE `purchase_orders` CHANGE COLUMN `payment_term_id` `paymentTermId` VARCHAR(36) NULL',
    'SELECT ''skip paymentTermId (already camelCase or missing snake)'' AS note'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

/* purchase_orders.delivery_term_id -> deliveryTermId */
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'delivery_term_id'
    )
    AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'deliveryTermId'
    ),
    'ALTER TABLE `purchase_orders` CHANGE COLUMN `delivery_term_id` `deliveryTermId` VARCHAR(36) NULL',
    'SELECT ''skip deliveryTermId (already camelCase or missing snake)'' AS note'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

/* purchase_orders.terms_and_conditions -> termsAndConditions */
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'terms_and_conditions'
    )
    AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'termsAndConditions'
    ),
    'ALTER TABLE `purchase_orders` CHANGE COLUMN `terms_and_conditions` `termsAndConditions` TEXT NULL',
    'SELECT ''skip termsAndConditions (already camelCase or missing snake)'' AS note'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

/* purchase_order_lines.line_type -> lineType */
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines' AND COLUMN_NAME = 'line_type'
    )
    AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_order_lines' AND COLUMN_NAME = 'lineType'
    ),
    'ALTER TABLE `purchase_order_lines` CHANGE COLUMN `line_type` `lineType` VARCHAR(16) NOT NULL DEFAULT ''GOODS''',
    'SELECT ''skip lineType (already camelCase or missing snake)'' AS note'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
