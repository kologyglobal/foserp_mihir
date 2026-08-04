-- Configurable PO release workflow before GRN receiving (idempotent).
SET @db = DATABASE();

SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_settings' AND COLUMN_NAME = 'requirePoReleaseWorkflow'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_settings` ADD COLUMN `requirePoReleaseWorkflow` BOOLEAN NOT NULL DEFAULT true AFTER `requireApprovalOnPo`',
  'SELECT ''requirePoReleaseWorkflow exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
