-- Manufacturing quality inspections SoT table rename.
-- Idempotent: rename quality_inspections → mfg_quality_inspections when needed.

SET @has_old := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_inspections'
);
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mfg_quality_inspections'
);

SET @sql := IF(
  @has_old > 0 AND @has_new = 0,
  'RENAME TABLE `quality_inspections` TO `mfg_quality_inspections`',
  'SELECT 1 AS mfg_quality_inspections_ok'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
