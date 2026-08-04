-- Incoming Quality Unification: Purchase QI plan refs + lifecycle timestamps + NCR source

-- Purchase QI header extensions
ALTER TABLE `purchase_quality_inspections`
  ADD COLUMN `result` VARCHAR(32) NULL,
  ADD COLUMN `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `inspectionPlanId` VARCHAR(191) NULL,
  ADD COLUMN `inspectionPlanRevisionId` VARCHAR(191) NULL,
  ADD COLUMN `planCodeSnapshot` VARCHAR(64) NULL,
  ADD COLUMN `planRevisionSnapshot` VARCHAR(32) NULL,
  ADD COLUMN `assignedAt` DATETIME(3) NULL,
  ADD COLUMN `startedAt` DATETIME(3) NULL;

CREATE INDEX `purchase_quality_inspections_tenantId_inspectedById_idx`
  ON `purchase_quality_inspections`(`tenantId`, `inspectedById`);
CREATE INDEX `purchase_quality_inspections_tenantId_inspectionPlanId_idx`
  ON `purchase_quality_inspections`(`tenantId`, `inspectionPlanId`);

-- Parameter checklist: optional master source snapshot
ALTER TABLE `purchase_quality_inspection_parameters`
  ADD COLUMN `sourceParameterId` VARCHAR(191) NULL,
  ADD COLUMN `parameterCode` VARCHAR(64) NULL;

-- NCR source linking for Purchase QI (optional open; not auto-create)
ALTER TABLE `quality_ncrs`
  ADD COLUMN `sourceType` VARCHAR(64) NULL,
  ADD COLUMN `sourceId` VARCHAR(191) NULL,
  ADD COLUMN `goodsReceiptId` VARCHAR(191) NULL;

CREATE INDEX `quality_ncrs_tenantId_sourceType_sourceId_idx`
  ON `quality_ncrs`(`tenantId`, `sourceType`, `sourceId`);
CREATE INDEX `quality_ncrs_tenantId_goodsReceiptId_idx`
  ON `quality_ncrs`(`tenantId`, `goodsReceiptId`);
CREATE INDEX `quality_ncrs_tenantId_supplierId_idx`
  ON `quality_ncrs`(`tenantId`, `supplierId`);
