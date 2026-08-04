-- Purchase backdated PO policy fields on purchase_settings
-- Idempotent for Hostinger / phpMyAdmin

SELECT DATABASE() AS db_name, NOW() AS run_at;

SET @db = DATABASE();

SET @col1 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_settings' AND COLUMN_NAME = 'allowBackdatedPo'
);
SET @sql1 = IF(
  @col1 = 0,
  'ALTER TABLE purchase_settings ADD COLUMN allowBackdatedPo TINYINT(1) NOT NULL DEFAULT 0 AFTER requireApprovalOnPo',
  'SELECT ''allowBackdatedPo exists'' AS note'
);
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col2 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_settings' AND COLUMN_NAME = 'backdatedPoDaysLimit'
);
SET @sql2 = IF(
  @col2 = 0,
  'ALTER TABLE purchase_settings ADD COLUMN backdatedPoDaysLimit INT NOT NULL DEFAULT 0 AFTER allowBackdatedPo',
  'SELECT ''backdatedPoDaysLimit exists'' AS note'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @col3 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_settings' AND COLUMN_NAME = 'requireApprovalForBackdatedPo'
);
SET @sql3 = IF(
  @col3 = 0,
  'ALTER TABLE purchase_settings ADD COLUMN requireApprovalForBackdatedPo TINYINT(1) NOT NULL DEFAULT 1 AFTER backdatedPoDaysLimit',
  'SELECT ''requireApprovalForBackdatedPo exists'' AS note'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
