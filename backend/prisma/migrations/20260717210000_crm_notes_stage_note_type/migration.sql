-- Stage-specific / typed CRM entity notes (additive rows; never overwrite prior stage notes)

ALTER TABLE `crm_notes` ADD COLUMN `stageCode` VARCHAR(64) NULL;
ALTER TABLE `crm_notes` ADD COLUMN `noteType` VARCHAR(64) NULL;

CREATE INDEX `crm_notes_tenantId_entityType_entityId_stageCode_idx` ON `crm_notes`(`tenantId`, `entityType`, `entityId`, `stageCode`);
CREATE INDEX `crm_notes_tenantId_entityType_entityId_noteType_idx` ON `crm_notes`(`tenantId`, `entityType`, `entityId`, `noteType`);
