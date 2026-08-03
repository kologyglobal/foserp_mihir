-- HRMS Phase 7 — Payroll Run & Calculation Engine

CREATE TABLE `hr_payroll_periods` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'PROCESSING', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_payroll_periods_tenantId_legalEntityId_year_month_key`(`tenantId`, `legalEntityId`, `year`, `month`),
    INDEX `hr_payroll_periods_tenantId_idx`(`tenantId`),
    INDEX `hr_payroll_periods_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `hr_payroll_periods_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `hr_payroll_periods_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_payroll_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `payrollPeriodId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `code` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `employeeCount` INTEGER NOT NULL DEFAULT 0,
    `grossAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `deductionAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `employerAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `calculatedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedByUserId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `hr_payroll_runs_tenantId_code_key`(`tenantId`, `code`),
    INDEX `hr_payroll_runs_tenantId_idx`(`tenantId`),
    INDEX `hr_payroll_runs_tenantId_payrollPeriodId_idx`(`tenantId`, `payrollPeriodId`),
    INDEX `hr_payroll_runs_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `hr_payroll_runs_tenantId_branchId_idx`(`tenantId`, `branchId`),
    INDEX `hr_payroll_runs_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `hr_payroll_runs_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_payroll_employee_results` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `payrollRunId` VARCHAR(191) NOT NULL,
    `payrollPeriodId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `salaryStructureId` VARCHAR(191) NULL,
    `salaryStructureVersionId` VARCHAR(191) NULL,
    `salaryAssignmentId` VARCHAR(191) NULL,
    `totalCalendarDays` INTEGER NOT NULL DEFAULT 0,
    `basisDays` INTEGER NOT NULL DEFAULT 0,
    `payableDays` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `presentDays` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `paidLeaveDays` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `unpaidLeaveDays` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `lopDays` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `weeklyOffDays` INTEGER NOT NULL DEFAULT 0,
    `holidayDays` INTEGER NOT NULL DEFAULT 0,
    `approvedOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `grossAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `deductionAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `employerAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'CALCULATED', 'EXCLUDED', 'ERROR', 'FINALIZED') NOT NULL DEFAULT 'PENDING',
    `paidDaysBreakdownJson` LONGTEXT NULL,
    `calculationNotesJson` LONGTEXT NULL,
    `errorCode` VARCHAR(64) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hr_payroll_employee_results_payrollRunId_employeeId_key`(`payrollRunId`, `employeeId`),
    UNIQUE INDEX `hr_pay_emp_res_tenant_period_emp_key`(`tenantId`, `payrollPeriodId`, `employeeId`),
    INDEX `hr_payroll_employee_results_tenantId_idx`(`tenantId`),
    INDEX `hr_payroll_employee_results_tenantId_payrollRunId_idx`(`tenantId`, `payrollRunId`),
    INDEX `hr_payroll_employee_results_tenantId_employeeId_idx`(`tenantId`, `employeeId`),
    INDEX `hr_payroll_employee_results_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_payroll_component_results` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `payrollEmployeeResultId` VARCHAR(191) NOT NULL,
    `salaryComponentId` VARCHAR(191) NULL,
    `componentCode` VARCHAR(32) NOT NULL,
    `componentName` VARCHAR(150) NOT NULL,
    `type` ENUM('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION') NOT NULL,
    `calculationType` ENUM('FIXED', 'PERCENTAGE', 'ATTENDANCE_LINKED', 'OT_LINKED', 'STATUTORY') NOT NULL,
    `calculationBasis` VARCHAR(120) NULL,
    `quantity` DECIMAL(12, 4) NULL,
    `rate` DECIMAL(14, 4) NULL,
    `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sequence` INTEGER NOT NULL DEFAULT 10,
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hr_payroll_component_results_tenantId_idx`(`tenantId`),
    INDEX `hr_pay_comp_res_tenant_emp_res_idx`(`tenantId`, `payrollEmployeeResultId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hr_payroll_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `payrollRunId` VARCHAR(191) NOT NULL,
    `payrollEmployeeResultId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `code` VARCHAR(64) NOT NULL,
    `severity` ENUM('BLOCKER', 'WARNING') NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `hr_payroll_exceptions_tenantId_idx`(`tenantId`),
    INDEX `hr_payroll_exceptions_tenantId_payrollRunId_idx`(`tenantId`, `payrollRunId`),
    INDEX `hr_payroll_exceptions_tenantId_severity_idx`(`tenantId`, `severity`),
    INDEX `hr_payroll_exceptions_tenantId_code_idx`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hr_payroll_periods`
  ADD CONSTRAINT `hr_payroll_periods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_periods_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `hr_payroll_runs`
  ADD CONSTRAINT `hr_payroll_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_runs_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `hr_payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_runs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hr_payroll_employee_results`
  ADD CONSTRAINT `hr_payroll_employee_results_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_employee_results_payrollRunId_fkey` FOREIGN KEY (`payrollRunId`) REFERENCES `hr_payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_employee_results_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `hr_employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hr_payroll_component_results`
  ADD CONSTRAINT `hr_payroll_component_results_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_component_results_payrollEmployeeResultId_fkey` FOREIGN KEY (`payrollEmployeeResultId`) REFERENCES `hr_payroll_employee_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hr_payroll_exceptions`
  ADD CONSTRAINT `hr_payroll_exceptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_exceptions_payrollRunId_fkey` FOREIGN KEY (`payrollRunId`) REFERENCES `hr_payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `hr_payroll_exceptions_payrollEmployeeResultId_fkey` FOREIGN KEY (`payrollEmployeeResultId`) REFERENCES `hr_payroll_employee_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
