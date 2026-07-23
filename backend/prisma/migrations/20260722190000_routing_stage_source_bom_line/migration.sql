-- Align routing stages with BOM: optional source BOM line reference on stage groups.

ALTER TABLE `manufacturing_stage_groups`
  ADD COLUMN `sourceBomLineId` VARCHAR(36) NULL AFTER `isActive`;

CREATE INDEX `mfg_stage_group_source_bom_line_idx`
  ON `manufacturing_stage_groups` (`tenantId`, `sourceBomLineId`);
