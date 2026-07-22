-- Quality Phase 4B — Parameter + Inspection Plan masters + inspection parameter results

CREATE TABLE `quality_parameters` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `parameterCode` VARCHAR(64) NOT NULL,
    `parameterName` VARCHAR(200) NOT NULL,
    `parameterType` ENUM('BOOLEAN', 'NUMERIC', 'TEXT', 'DROPDOWN', 'PHOTO_REQUIRED') NOT NULL,
    `uomCode` VARCHAR(32) NULL,
    `minValue` DECIMAL(18, 4) NULL,
    `maxValue` DECIMAL(18, 4) NULL,
    `targetValue` DECIMAL(18, 4) NULL,
    `mandatory` BOOLEAN NOT NULL DEFAULT true,
    `severity` ENUM('MINOR', 'MAJOR', 'CRITICAL') NOT NULL DEFAULT 'MAJOR',
    `passFailRule` ENUM('BOOLEAN_TRUE', 'BOOLEAN_FALSE', 'NUMERIC_TOLERANCE', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `dropdownOptions` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qp_tenant_code_key`(`tenantId`, `parameterCode`),
    INDEX `qp_tenant_idx`(`tenantId`),
    INDEX `qp_tenant_active_idx`(`tenantId`, `active`),
    INDEX `qp_tenant_deleted_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quality_inspection_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planCode` VARCHAR(64) NOT NULL,
    `planName` VARCHAR(200) NOT NULL,
    `category` ENUM('INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN') NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'DRAFT',
    `itemId` VARCHAR(191) NULL,
    `itemCategoryId` VARCHAR(191) NULL,
    `operationName` VARCHAR(120) NULL,
    `workCenterId` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `revision` VARCHAR(32) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qip_tenant_code_key`(`tenantId`, `planCode`),
    INDEX `qip_tenant_idx`(`tenantId`),
    INDEX `qip_tenant_status_idx`(`tenantId`, `status`),
    INDEX `qip_tenant_category_idx`(`tenantId`, `category`),
    INDEX `qip_tenant_item_idx`(`tenantId`, `itemId`),
    INDEX `qip_tenant_deleted_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quality_inspection_plan_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `parameterId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `mandatoryOverride` BOOLEAN NULL,
    `minValueOverride` DECIMAL(18, 4) NULL,
    `maxValueOverride` DECIMAL(18, 4) NULL,
    `targetValueOverride` DECIMAL(18, 4) NULL,
    `severityOverride` ENUM('MINOR', 'MAJOR', 'CRITICAL') NULL,
    `photoRequiredOverride` BOOLEAN NULL,
    `remarksRequired` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qipl_plan_param_key`(`planId`, `parameterId`),
    INDEX `qipl_tenant_idx`(`tenantId`),
    INDEX `qipl_tenant_plan_idx`(`tenantId`, `planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quality_inspections`
  ADD COLUMN `inspectionPlanId` VARCHAR(191) NULL,
  ADD COLUMN `parameterSnapshotJson` JSON NULL;

CREATE INDEX `qi_tenant_plan_idx` ON `quality_inspections`(`tenantId`, `inspectionPlanId`);

CREATE TABLE `quality_inspection_parameter_results` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inspectionId` VARCHAR(191) NOT NULL,
    `parameterId` VARCHAR(191) NOT NULL,
    `parameterCode` VARCHAR(64) NOT NULL,
    `parameterName` VARCHAR(200) NOT NULL,
    `parameterType` ENUM('BOOLEAN', 'NUMERIC', 'TEXT', 'DROPDOWN', 'PHOTO_REQUIRED') NOT NULL,
    `mandatory` BOOLEAN NOT NULL DEFAULT true,
    `severity` ENUM('MINOR', 'MAJOR', 'CRITICAL') NOT NULL,
    `passFailRule` ENUM('BOOLEAN_TRUE', 'BOOLEAN_FALSE', 'NUMERIC_TOLERANCE', 'MANUAL') NOT NULL,
    `uomCode` VARCHAR(32) NULL,
    `minValue` DECIMAL(18, 4) NULL,
    `maxValue` DECIMAL(18, 4) NULL,
    `targetValue` DECIMAL(18, 4) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `measuredValue` VARCHAR(500) NULL,
    `measuredNumeric` DECIMAL(18, 4) NULL,
    `passed` BOOLEAN NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qipr_insp_param_key`(`inspectionId`, `parameterId`),
    INDEX `qipr_tenant_idx`(`tenantId`),
    INDEX `qipr_tenant_insp_idx`(`tenantId`, `inspectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quality_inspection_plans`
  ADD CONSTRAINT `qip_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `qip_item_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quality_parameters`
  ADD CONSTRAINT `qp_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `quality_inspection_plan_lines`
  ADD CONSTRAINT `qipl_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `qipl_plan_fkey`
    FOREIGN KEY (`planId`) REFERENCES `quality_inspection_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `qipl_param_fkey`
    FOREIGN KEY (`parameterId`) REFERENCES `quality_parameters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `quality_inspections`
  ADD CONSTRAINT `qi_plan_fkey`
    FOREIGN KEY (`inspectionPlanId`) REFERENCES `quality_inspection_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quality_inspection_parameter_results`
  ADD CONSTRAINT `qipr_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `qipr_insp_fkey`
    FOREIGN KEY (`inspectionId`) REFERENCES `quality_inspections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
