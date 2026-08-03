-- HRMS Phase 3 — Leave Management

CREATE TABLE IF NOT EXISTS `hr_leave_types` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `paid` BOOLEAN NOT NULL DEFAULT true,
  `allowHalfDay` BOOLEAN NOT NULL DEFAULT true,
  `allowNegativeBalance` BOOLEAN NOT NULL DEFAULT false,
  `carryForwardAllowed` BOOLEAN NOT NULL DEFAULT false,
  `maxCarryForward` DECIMAL(8, 2) NULL,
  `accrualType` ENUM('NONE','MONTHLY','YEARLY') NOT NULL DEFAULT 'NONE',
  `accrualValue` DECIMAL(8, 2) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_leave_types_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_leave_types_tenantId_idx` (`tenantId`),
  INDEX `hr_leave_types_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_leave_types_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_leave_types_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_types_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_policies` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `workerCategory` ENUM('STAFF','WORKER','SUPERVISOR','MANAGEMENT') NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `excludeHolidays` BOOLEAN NOT NULL DEFAULT true,
  `excludeWeeklyOff` BOOLEAN NOT NULL DEFAULT true,
  `allowNegativeBalance` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_leave_policies_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_leave_policies_tenantId_idx` (`tenantId`),
  INDEX `hr_leave_policies_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_leave_policies_tenantId_branchId_idx` (`tenantId`, `branchId`),
  INDEX `hr_leave_policies_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_leave_policies_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_policies_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_policies_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_policy_leave_types` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_leave_policy_leave_types_policyId_leaveTypeId_key` (`policyId`, `leaveTypeId`),
  INDEX `hr_leave_policy_leave_types_tenantId_idx` (`tenantId`),
  CONSTRAINT `hr_leave_policy_leave_types_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_policy_leave_types_policyId_fkey`
    FOREIGN KEY (`policyId`) REFERENCES `hr_leave_policies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_policy_leave_types_leaveTypeId_fkey`
    FOREIGN KEY (`leaveTypeId`) REFERENCES `hr_leave_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_balances` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `opening` DECIMAL(8, 2) NOT NULL DEFAULT 0,
  `accrued` DECIMAL(8, 2) NOT NULL DEFAULT 0,
  `pending` DECIMAL(8, 2) NOT NULL DEFAULT 0,
  `used` DECIMAL(8, 2) NOT NULL DEFAULT 0,
  `adjusted` DECIMAL(8, 2) NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_leave_balances_tenantId_employeeId_leaveTypeId_year_key` (`tenantId`, `employeeId`, `leaveTypeId`, `year`),
  INDEX `hr_leave_balances_tenantId_idx` (`tenantId`),
  INDEX `hr_leave_balances_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_leave_balances_tenantId_leaveTypeId_idx` (`tenantId`, `leaveTypeId`),
  CONSTRAINT `hr_leave_balances_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_balances_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_balances_leaveTypeId_fkey`
    FOREIGN KEY (`leaveTypeId`) REFERENCES `hr_leave_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_balance_adjustments` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `balanceId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `amount` DECIMAL(8, 2) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `effectiveDate` DATE NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `hr_leave_balance_adjustments_tenantId_idx` (`tenantId`),
  INDEX `hr_leave_balance_adjustments_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_leave_balance_adjustments_tenantId_balanceId_idx` (`tenantId`, `balanceId`),
  CONSTRAINT `hr_leave_balance_adjustments_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_balance_adjustments_balanceId_fkey`
    FOREIGN KEY (`balanceId`) REFERENCES `hr_leave_balances` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_requests` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `fromDate` DATE NOT NULL,
  `toDate` DATE NOT NULL,
  `durationType` ENUM('FULL_DAY','FIRST_HALF','SECOND_HALF') NOT NULL DEFAULT 'FULL_DAY',
  `requestedDays` DECIMAL(8, 2) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `submittedAt` DATETIME(3) NULL,
  `approvedByUserId` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectionReason` VARCHAR(500) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledByUserId` VARCHAR(191) NULL,
  `cancellationReason` VARCHAR(500) NULL,
  `attachmentOriginalFilename` VARCHAR(255) NULL,
  `attachmentStoredFilename` VARCHAR(255) NULL,
  `attachmentMimeType` VARCHAR(120) NULL,
  `attachmentFileSize` INTEGER NULL,
  `attachmentStoragePath` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_leave_requests_tenantId_idx` (`tenantId`),
  INDEX `hr_leave_requests_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_leave_requests_tenantId_leaveTypeId_idx` (`tenantId`, `leaveTypeId`),
  INDEX `hr_leave_requests_tenantId_status_idx` (`tenantId`, `status`),
  INDEX `hr_leave_requests_tenantId_fromDate_toDate_idx` (`tenantId`, `fromDate`, `toDate`),
  INDEX `hr_leave_requests_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_leave_requests_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_requests_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_leave_requests_leaveTypeId_fkey`
    FOREIGN KEY (`leaveTypeId`) REFERENCES `hr_leave_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
