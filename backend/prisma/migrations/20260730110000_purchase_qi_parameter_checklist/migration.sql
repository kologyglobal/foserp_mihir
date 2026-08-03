-- Purchase QI parameter checklist persistence (incoming inspection plan + per-parameter results).

ALTER TABLE `purchase_quality_inspections`
  ADD COLUMN `inspectionPlan` VARCHAR(300) NULL AFTER `warehouseId`;

CREATE TABLE `purchase_quality_inspection_parameters` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `qualityInspectionId` VARCHAR(191) NOT NULL,
  `lineNumber` INT NOT NULL,
  `parameterName` VARCHAR(200) NOT NULL,
  `specification` VARCHAR(500) NOT NULL DEFAULT '',
  `minValue` DECIMAL(18, 4) NULL,
  `maxValue` DECIMAL(18, 4) NULL,
  `observedValue` DECIMAL(18, 4) NULL,
  `unit` VARCHAR(32) NOT NULL DEFAULT '',
  `result` VARCHAR(16) NOT NULL DEFAULT 'na',
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `qi_params_tenant_qi_lineno_key`(`tenantId`, `qualityInspectionId`, `lineNumber`),
  INDEX `purchase_quality_inspection_parameters_tenantId_idx`(`tenantId`),
  INDEX `qi_params_tenant_qi_idx`(`tenantId`, `qualityInspectionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_quality_inspection_parameters`
  ADD CONSTRAINT `purchase_quality_inspection_parameters_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_quality_inspection_parameters_qualityInspectionId_fkey`
    FOREIGN KEY (`qualityInspectionId`) REFERENCES `purchase_quality_inspections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
