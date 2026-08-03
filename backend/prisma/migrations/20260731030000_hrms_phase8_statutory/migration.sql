-- HRMS Phase 8 — Indian Statutory Payroll Foundation

-- Extend employee statutory profile
ALTER TABLE `hr_employee_statutory_details`
  ADD COLUMN `pfApplicable` BOOLEAN NULL,
  ADD COLUMN `esicApplicable` BOOLEAN NULL,
  ADD COLUMN `ptApplicable` BOOLEAN NULL,
  ADD COLUMN `tdsApplicable` BOOLEAN NULL,
  ADD COLUMN `lwfApplicable` BOOLEAN NULL,
  ADD COLUMN `taxRegime` VARCHAR(16) NULL,
  ADD COLUMN `previousEmploymentIncome` DECIMAL(14, 2) NULL,
  ADD COLUMN `declaredDeductions` DECIMAL(14, 2) NULL,
  ADD COLUMN `taxAlreadyDeducted` DECIMAL(14, 2) NULL,
  ADD COLUMN `tdsManualMonthly` DECIMAL(14, 2) NULL,
  ADD COLUMN `tdsManualReason` VARCHAR(500) NULL,
  ADD COLUMN `overrideReason` VARCHAR(500) NULL,
  ADD COLUMN `overrideByUserId` VARCHAR(191) NULL,
  ADD COLUMN `overrideAt` DATETIME(3) NULL;

CREATE TABLE `hr_statutory_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NULL,
    `type` ENUM('PF', 'ESIC', 'PROFESSIONAL_TAX', 'TDS', 'LWF', 'BONUS', 'GRATUITY') NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `stateCode` VARCHAR(8) NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `employeeRatePct` DECIMAL(8, 4) NULL,
    `employerRatePct` DECIMAL(8, 4) NULL,
    `wageCeiling` DECIMAL(14, 2) NULL,
    `eligibilityWageCeiling` DECIMAL(14, 2) NULL,
    `roundingMode` ENUM('NONE', 'NEAREST', 'UP', 'DOWN') NOT NULL DEFAULT 'NEAREST',
    `frequency` VARCHAR(16) NULL,
    `employeeFixedAmount` DECIMAL(14, 2) NULL,
    `employerFixedAmount` DECIMAL(14, 2) NULL,
    `configJson` LONGTEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_statutory_rules_tenantId_code_key`(`tenantId`, `code`),
    INDEX `hr_statutory_rules_tenantId_idx`(`tenantId`),
    INDEX `hr_statutory_rules_tenantId_type_idx`(`tenantId`, `type`),
    INDEX `hr_statutory_rules_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `hr_statutory_rules_tenantId_stateCode_idx`(`tenantId`, `stateCode`),
    INDEX `hr_statutory_rules_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `hr_statutory_rules_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_statutory_wage_basis_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `statutoryRuleId` VARCHAR(191) NOT NULL,
    `componentCode` VARCHAR(32) NOT NULL,
    `salaryComponentId` VARCHAR(191) NULL,
    `sequence` INTEGER NOT NULL DEFAULT 10,
    `include` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `hr_statutory_wage_basis_lines_statutoryRuleId_componentCode_key`(`statutoryRuleId`, `componentCode`),
    INDEX `hr_statutory_wage_basis_lines_tenantId_idx`(`tenantId`),
    INDEX `hr_statutory_wage_basis_lines_tenantId_statutoryRuleId_idx`(`tenantId`, `statutoryRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_statutory_pt_slabs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `statutoryRuleId` VARCHAR(191) NOT NULL,
    `fromAmount` DECIMAL(14, 2) NOT NULL,
    `toAmount` DECIMAL(14, 2) NULL,
    `taxAmount` DECIMAL(14, 2) NOT NULL,
    `specialMonth` INTEGER NULL,
    `sequence` INTEGER NOT NULL DEFAULT 10,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hr_statutory_pt_slabs_tenantId_idx`(`tenantId`),
    INDEX `hr_statutory_pt_slabs_tenantId_statutoryRuleId_idx`(`tenantId`, `statutoryRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hr_statutory_rules`
  ADD CONSTRAINT `hr_statutory_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_statutory_rules_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hr_statutory_wage_basis_lines`
  ADD CONSTRAINT `hr_statutory_wage_basis_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_statutory_wage_basis_lines_statutoryRuleId_fkey` FOREIGN KEY (`statutoryRuleId`) REFERENCES `hr_statutory_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hr_statutory_pt_slabs`
  ADD CONSTRAINT `hr_statutory_pt_slabs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_statutory_pt_slabs_statutoryRuleId_fkey` FOREIGN KEY (`statutoryRuleId`) REFERENCES `hr_statutory_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
