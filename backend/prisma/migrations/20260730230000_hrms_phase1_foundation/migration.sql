-- HRMS Phase 1 — Foundation + Employee Master
-- Reuses LegalEntity / Branch / Department / User / CodeSeries / AuditLog.
-- Does NOT implement Shift / Attendance / Leave / OT / Payroll (later phases).

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER','LEAD','CONTACT','CRM_COMPANY','OPPORTUNITY','QUOTATION','SALES_ORDER',
  'PRODUCTION_DEMAND','PRODUCTION_ORDER','DAILY_PRODUCTION_BATCH','PRODUCTION_ISSUE',
  'STOCK_MOVEMENT','STOCK_RESERVATION','PURCHASE_REQUISITION','PURCHASE_PLANNING',
  'REQUEST_FOR_QUOTATION','VENDOR_QUOTATION','VENDOR_COMPARISON','PURCHASE_ORDER',
  'GOODS_RECEIPT','QUALITY_INSPECTION','QUALITY_NCR','PURCHASE_INVOICE','PURCHASE_RETURN',
  'JOB_WORK_ORDER','PRODUCTION_RUNTIME_CHANGE','PRODUCTION_WIP_MOVEMENT','MANUFACTURING_CORRECTION',
  'PRODUCTION_PLAN','DEMAND_CONSOLIDATION_PLAN','OUTBOUND_DISPATCH','PRODUCTION_FG_RECEIPT',
  'DISPATCH_REQUIREMENT','DISPATCH_PICK_LIST','DISPATCH_PACKING_SESSION','DISPATCH_PACKAGE',
  'DELIVERY_CHALLAN','PURCHASE_QUALITY_INSPECTION','INVENTORY_TRANSFER','INVENTORY_STOCK_COUNT',
  'INVENTORY_ADJUSTMENT','MANUFACTURING_ROUTING','DISPATCH_POSTING','DISPATCH_REVERSAL',
  'MAINTENANCE_TICKET','PREVENTIVE_MAINTENANCE_PLAN','EMPLOYEE'
) NOT NULL;

CREATE TABLE IF NOT EXISTS `hr_designations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `level` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_designations_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_designations_tenantId_idx` (`tenantId`),
  INDEX `hr_designations_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_designations_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_designations_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_designations_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employees` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeCode` VARCHAR(32) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `departmentId` VARCHAR(191) NOT NULL,
  `designationId` VARCHAR(191) NOT NULL,
  `primaryWorkCentreId` VARCHAR(191) NULL,
  `firstName` VARCHAR(100) NOT NULL,
  `middleName` VARCHAR(100) NULL,
  `lastName` VARCHAR(100) NOT NULL,
  `displayName` VARCHAR(220) NOT NULL,
  `mobile` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `dateOfBirth` DATE NULL,
  `gender` ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') NULL,
  `addressLine` VARCHAR(300) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pin` VARCHAR(12) NULL,
  `country` VARCHAR(100) NULL,
  `joinDate` DATE NOT NULL,
  `employmentType` ENUM('PERMANENT','PROBATION','CONTRACT','TRAINEE','INTERN','TEMPORARY') NOT NULL,
  `workerCategory` ENUM('STAFF','WORKER','SUPERVISOR','MANAGEMENT') NOT NULL,
  `reportingManagerEmployeeId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT','ACTIVE','ON_NOTICE','INACTIVE','EXITED') NOT NULL DEFAULT 'DRAFT',
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_employees_tenantId_employeeCode_key` (`tenantId`, `employeeCode`),
  INDEX `hr_employees_tenantId_idx` (`tenantId`),
  INDEX `hr_employees_tenantId_userId_idx` (`tenantId`, `userId`),
  INDEX `hr_employees_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_employees_tenantId_branchId_idx` (`tenantId`, `branchId`),
  INDEX `hr_employees_tenantId_departmentId_idx` (`tenantId`, `departmentId`),
  INDEX `hr_employees_tenantId_designationId_idx` (`tenantId`, `designationId`),
  INDEX `hr_employees_tenantId_primaryWorkCentreId_idx` (`tenantId`, `primaryWorkCentreId`),
  INDEX `hr_employees_tenantId_reportingManagerEmployeeId_idx` (`tenantId`, `reportingManagerEmployeeId`),
  INDEX `hr_employees_tenantId_status_idx` (`tenantId`, `status`),
  INDEX `hr_employees_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_employees_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_departmentId_fkey`
    FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_designationId_fkey`
    FOREIGN KEY (`designationId`) REFERENCES `hr_designations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_primaryWorkCentreId_fkey`
    FOREIGN KEY (`primaryWorkCentreId`) REFERENCES `manufacturing_work_centres` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `hr_employees_reportingManagerEmployeeId_fkey`
    FOREIGN KEY (`reportingManagerEmployeeId`) REFERENCES `hr_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employee_employment_history` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `field` ENUM(
    'LEGAL_ENTITY','BRANCH','DEPARTMENT','DESIGNATION','REPORTING_MANAGER',
    'WORK_CENTRE','EMPLOYMENT_TYPE','STATUS','USER_LINK'
  ) NOT NULL,
  `oldValue` VARCHAR(300) NULL,
  `newValue` VARCHAR(300) NULL,
  `effectiveFrom` DATETIME(3) NOT NULL,
  `changedBy` VARCHAR(191) NULL,
  `reason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `hr_employee_employment_history_tenantId_idx` (`tenantId`),
  INDEX `hr_employee_employment_history_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_emp_employment_history_tenant_emp_effFrom_idx` (`tenantId`, `employeeId`, `effectiveFrom`),
  CONSTRAINT `hr_employee_employment_history_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_employment_history_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employee_bank_details` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `bankName` VARCHAR(150) NOT NULL,
  `accountHolderName` VARCHAR(150) NOT NULL,
  `accountNumber` VARCHAR(34) NOT NULL,
  `ifsc` VARCHAR(11) NOT NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `effectiveFrom` DATETIME(3) NULL,
  `effectiveTo` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_employee_bank_details_tenantId_idx` (`tenantId`),
  INDEX `hr_employee_bank_details_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_employee_bank_details_tenantId_employeeId_deletedAt_idx` (`tenantId`, `employeeId`, `deletedAt`),
  CONSTRAINT `hr_employee_bank_details_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_bank_details_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employee_statutory_details` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `pan` VARCHAR(10) NULL,
  `aadhaarRef` VARCHAR(64) NULL,
  `uan` VARCHAR(20) NULL,
  `esicNumber` VARCHAR(30) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_employee_statutory_details_employeeId_key` (`employeeId`),
  INDEX `hr_employee_statutory_details_tenantId_idx` (`tenantId`),
  CONSTRAINT `hr_employee_statutory_details_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_statutory_details_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employee_documents` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `documentType` ENUM(
    'PHOTO','PAN','AADHAAR','BANK_PROOF','APPOINTMENT_LETTER','EXPERIENCE',
    'QUALIFICATION','SKILL_CERTIFICATE','SALARY_REVISION','OTHER'
  ) NOT NULL,
  `originalFilename` VARCHAR(255) NOT NULL,
  `storedFilename` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `storagePath` VARCHAR(500) NOT NULL,
  `notes` VARCHAR(500) NULL,
  `uploadedBy` VARCHAR(191) NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_employee_documents_tenantId_idx` (`tenantId`),
  INDEX `hr_employee_documents_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_employee_documents_tenantId_employeeId_deletedAt_idx` (`tenantId`, `employeeId`, `deletedAt`),
  CONSTRAINT `hr_employee_documents_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_documents_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
