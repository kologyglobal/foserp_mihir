-- HRMS Phase 6 — Salary Components + Structures (config only; no payroll calc)

CREATE TABLE `hr_salary_components` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION') NOT NULL,
    `calculationType` ENUM('FIXED', 'PERCENTAGE', 'ATTENDANCE_LINKED', 'OT_LINKED', 'STATUTORY') NOT NULL,
    `taxable` BOOLEAN NOT NULL DEFAULT true,
    `affectsGross` BOOLEAN NOT NULL DEFAULT true,
    `affectsNet` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_salary_components_tenantId_code_key`(`tenantId`, `code`),
    INDEX `hr_salary_components_tenantId_idx`(`tenantId`),
    INDEX `hr_salary_components_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `hr_salary_components_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_salary_structures` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `workerCategory` ENUM('STAFF', 'WORKER', 'SUPERVISOR', 'MANAGEMENT') NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_salary_structures_tenantId_code_key`(`tenantId`, `code`),
    INDEX `hr_salary_structures_tenantId_idx`(`tenantId`),
    INDEX `hr_salary_structures_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `hr_salary_structures_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_salary_structure_versions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `salaryStructureId` VARCHAR(191) NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `createdBy` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_salary_structure_versions_salaryStructureId_versionNo_key`(`salaryStructureId`, `versionNo`),
    INDEX `hr_salary_structure_versions_tenantId_idx`(`tenantId`),
    INDEX `hr_salary_structure_versions_tenantId_salaryStructureId_idx`(`tenantId`, `salaryStructureId`),
    INDEX `hr_salary_structure_versions_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `hr_salary_structure_versions_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_salary_structure_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `salaryComponentId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 10,
    `calculationType` ENUM('FIXED', 'PERCENTAGE', 'ATTENDANCE_LINKED', 'OT_LINKED', 'STATUTORY') NOT NULL,
    `fixedAmount` DECIMAL(14, 2) NULL,
    `percentage` DECIMAL(8, 4) NULL,
    `percentageOfComponentId` VARCHAR(191) NULL,
    `monthlyCap` DECIMAL(14, 2) NULL,
    `annualCap` DECIMAL(14, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_salary_structure_lines_versionId_salaryComponentId_key`(`versionId`, `salaryComponentId`),
    INDEX `hr_salary_structure_lines_tenantId_idx`(`tenantId`),
    INDEX `hr_salary_structure_lines_tenantId_versionId_idx`(`tenantId`, `versionId`),
    INDEX `hr_salary_structure_lines_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_employee_salary_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `salaryStructureVersionId` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `annualCtc` DECIMAL(14, 2) NULL,
    `monthlyGross` DECIMAL(14, 2) NULL,
    `remarks` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `hr_employee_salary_assignments_tenantId_idx`(`tenantId`),
    INDEX `hr_employee_salary_assignments_tenantId_employeeId_idx`(`tenantId`, `employeeId`),
    INDEX `hr_emp_sal_asgn_tenant_emp_eff_idx`(`tenantId`, `employeeId`, `effectiveFrom`),
    INDEX `hr_emp_sal_asgn_tenant_ver_idx`(`tenantId`, `salaryStructureVersionId`),
    INDEX `hr_employee_salary_assignments_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `hr_employee_salary_assignments_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hr_salary_components`
  ADD CONSTRAINT `hr_salary_components_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_components_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hr_salary_structures`
  ADD CONSTRAINT `hr_salary_structures_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_structures_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hr_salary_structure_versions`
  ADD CONSTRAINT `hr_salary_structure_versions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_structure_versions_salaryStructureId_fkey` FOREIGN KEY (`salaryStructureId`) REFERENCES `hr_salary_structures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hr_salary_structure_lines`
  ADD CONSTRAINT `hr_salary_structure_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_structure_lines_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `hr_salary_structure_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_structure_lines_salaryComponentId_fkey` FOREIGN KEY (`salaryComponentId`) REFERENCES `hr_salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_salary_structure_lines_percentageOfComponentId_fkey` FOREIGN KEY (`percentageOfComponentId`) REFERENCES `hr_salary_components`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hr_employee_salary_assignments`
  ADD CONSTRAINT `hr_employee_salary_assignments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_employee_salary_assignments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `hr_employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_employee_salary_assignments_salaryStructureVersionId_fkey` FOREIGN KEY (`salaryStructureVersionId`) REFERENCES `hr_salary_structure_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
