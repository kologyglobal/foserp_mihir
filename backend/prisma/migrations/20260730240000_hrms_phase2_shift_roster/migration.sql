-- HRMS Phase 2 — Shift templates, holiday calendars, roster assignments

ALTER TABLE `hr_employee_employment_history`
  MODIFY COLUMN `field` ENUM(
    'LEGAL_ENTITY','BRANCH','DEPARTMENT','DESIGNATION','REPORTING_MANAGER',
    'WORK_CENTRE','EMPLOYMENT_TYPE','STATUS','USER_LINK','DEFAULT_SHIFT'
  ) NOT NULL;

-- Guarded (MySQL 8 has no ADD COLUMN IF NOT EXISTS) so a retry after a partial
-- prior apply of this migration does not fail on already-added columns.
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_employees' AND COLUMN_NAME = 'defaultShiftId');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `hr_employees` ADD COLUMN `defaultShiftId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_employees' AND COLUMN_NAME = 'weeklyOffDay');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `hr_employees` ADD COLUMN `weeklyOffDay` INTEGER NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `hr_shift_templates` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `startTime` VARCHAR(5) NOT NULL,
  `endTime` VARCHAR(5) NOT NULL,
  `breakMinutes` INTEGER NOT NULL DEFAULT 0,
  `graceInMinutes` INTEGER NOT NULL DEFAULT 0,
  `graceOutMinutes` INTEGER NULL,
  `fullDayMinimumMinutes` INTEGER NOT NULL,
  `halfDayMinimumMinutes` INTEGER NOT NULL,
  `otEligible` BOOLEAN NOT NULL DEFAULT true,
  `otStartsAfterMinutes` INTEGER NULL,
  `overnightShift` BOOLEAN NOT NULL DEFAULT false,
  `weeklyOffDay` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_shift_templates_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_shift_templates_tenantId_idx` (`tenantId`),
  INDEX `hr_shift_templates_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_shift_templates_tenantId_isActive_idx` (`tenantId`, `isActive`),
  INDEX `hr_shift_templates_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_shift_templates_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_shift_templates_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_holiday_calendars` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `year` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_holiday_calendars_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_holiday_calendars_tenantId_idx` (`tenantId`),
  INDEX `hr_holiday_calendars_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_holiday_calendars_tenantId_branchId_idx` (`tenantId`, `branchId`),
  INDEX `hr_holiday_calendars_tenantId_year_idx` (`tenantId`, `year`),
  INDEX `hr_holiday_calendars_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_holiday_calendars_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_holiday_calendars_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_holiday_calendars_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_holiday_calendar_days` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `calendarId` VARCHAR(191) NOT NULL,
  `holidayDate` DATE NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `holidayType` ENUM('NATIONAL','FESTIVAL','COMPANY','OPTIONAL') NOT NULL,
  `optionalHoliday` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_holiday_calendar_days_calendarId_holidayDate_key` (`calendarId`, `holidayDate`),
  INDEX `hr_holiday_calendar_days_tenantId_idx` (`tenantId`),
  INDEX `hr_holiday_calendar_days_tenantId_calendarId_idx` (`tenantId`, `calendarId`),
  INDEX `hr_holiday_calendar_days_tenantId_holidayDate_idx` (`tenantId`, `holidayDate`),
  INDEX `hr_holiday_calendar_days_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_holiday_calendar_days_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_holiday_calendar_days_calendarId_fkey`
    FOREIGN KEY (`calendarId`) REFERENCES `hr_holiday_calendars` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_employee_shift_assignments` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `shiftId` VARCHAR(191) NOT NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `source` ENUM('DEFAULT','ROSTER','TEMPORARY') NOT NULL DEFAULT 'ROSTER',
  `note` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_employee_shift_assignments_tenantId_idx` (`tenantId`),
  INDEX `hr_employee_shift_assignments_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_employee_shift_assignments_tenant_emp_effFrom_idx` (`tenantId`, `employeeId`, `effectiveFrom`),
  INDEX `hr_employee_shift_assignments_tenantId_shiftId_idx` (`tenantId`, `shiftId`),
  INDEX `hr_employee_shift_assignments_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_employee_shift_assignments_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_shift_assignments_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_employee_shift_assignments_shiftId_fkey`
    FOREIGN KEY (`shiftId`) REFERENCES `hr_shift_templates` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_employees' AND INDEX_NAME = 'hr_employees_tenantId_defaultShiftId_idx');
SET @ddl = IF(@idx_exists = 0, 'CREATE INDEX `hr_employees_tenantId_defaultShiftId_idx` ON `hr_employees` (`tenantId`, `defaultShiftId`)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_employees' AND CONSTRAINT_NAME = 'hr_employees_defaultShiftId_fkey');
SET @ddl = IF(@fk_exists = 0, 'ALTER TABLE `hr_employees` ADD CONSTRAINT `hr_employees_defaultShiftId_fkey` FOREIGN KEY (`defaultShiftId`) REFERENCES `hr_shift_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
