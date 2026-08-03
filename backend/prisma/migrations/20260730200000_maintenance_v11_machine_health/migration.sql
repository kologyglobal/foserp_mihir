-- Maintenance V1.1: failure SAFETY, root cause / repair action, repairEndedAt, PR source tracing

ALTER TABLE `maintenance_tickets`
  MODIFY COLUMN `failureCategory` ENUM(
    'MECHANICAL',
    'ELECTRICAL',
    'HYDRAULIC',
    'PNEUMATIC',
    'CONTROL',
    'SAFETY',
    'OTHER'
  ) NULL;

ALTER TABLE `maintenance_tickets`
  ADD COLUMN `repairEndedAt` DATETIME(3) NULL,
  ADD COLUMN `rootCause` TEXT NULL,
  ADD COLUMN `repairAction` TEXT NULL;

ALTER TABLE `purchase_requisitions`
  ADD COLUMN `sourceType` VARCHAR(40) NULL,
  ADD COLUMN `sourceId` VARCHAR(191) NULL,
  ADD COLUMN `sourceDocumentNumber` VARCHAR(64) NULL;

CREATE INDEX `purchase_requisitions_tenantId_sourceType_sourceId_idx`
  ON `purchase_requisitions` (`tenantId`, `sourceType`, `sourceId`);
