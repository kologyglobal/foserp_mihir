-- HRMS Phase 5 — Overtime + attendance worked-time fields for OT detection

ALTER TABLE `hr_attendance_days`
  ADD COLUMN `shiftId` VARCHAR(191) NULL AFTER `leaveTypeCode`,
  ADD COLUMN `firstInAt` DATETIME(3) NULL AFTER `shiftId`,
  ADD COLUMN `lastOutAt` DATETIME(3) NULL AFTER `firstInAt`,
  ADD COLUMN `workedMinutes` INT NULL AFTER `lastOutAt`,
  ADD COLUMN `isFinalized` BOOLEAN NOT NULL DEFAULT false AFTER `workedMinutes`,
  ADD COLUMN `finalizedAt` DATETIME(3) NULL AFTER `isFinalized`;

CREATE INDEX `hr_attendance_days_tenantId_isFinalized_idx` ON `hr_attendance_days` (`tenantId`, `isFinalized`);

CREATE TABLE IF NOT EXISTS `hr_overtime_policies` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `workerCategory` ENUM('STAFF','WORKER','SUPERVISOR','MANAGEMENT') NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `minimumExtraMinutes` INT NOT NULL DEFAULT 30,
  `roundingMinutes` INT NOT NULL DEFAULT 15,
  `maxOtMinutesPerDay` INT NULL,
  `maxOtMinutesPerMonth` INT NULL,
  `weeklyOffOtAllowed` BOOLEAN NOT NULL DEFAULT false,
  `holidayOtAllowed` BOOLEAN NOT NULL DEFAULT false,
  `leaveDayOtAllowed` BOOLEAN NOT NULL DEFAULT false,
  `requireApproval` BOOLEAN NOT NULL DEFAULT true,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_overtime_policies_tenantId_code_key` (`tenantId`, `code`),
  INDEX `hr_overtime_policies_tenantId_idx` (`tenantId`),
  INDEX `hr_overtime_policies_tenantId_legalEntityId_idx` (`tenantId`, `legalEntityId`),
  INDEX `hr_overtime_policies_tenantId_branchId_idx` (`tenantId`, `branchId`),
  INDEX `hr_overtime_policies_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_overtime_policies_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_overtime_policies_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_overtime_policies_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_overtime_records` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `attendanceDate` DATE NOT NULL,
  `attendanceDayId` VARCHAR(191) NULL,
  `shiftId` VARCHAR(191) NULL,
  `detectedMinutes` INT NOT NULL DEFAULT 0,
  `eligibleMinutes` INT NOT NULL DEFAULT 0,
  `approvedMinutes` INT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(1000) NULL,
  `requestedByUserId` VARCHAR(191) NULL,
  `approvedByUserId` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectionReason` VARCHAR(500) NULL,
  `source` ENUM('ATTENDANCE','MANUAL') NOT NULL DEFAULT 'ATTENDANCE',
  `exceptionFlags` VARCHAR(1000) NULL,
  `firstInAt` DATETIME(3) NULL,
  `lastOutAt` DATETIME(3) NULL,
  `workedMinutes` INT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledByUserId` VARCHAR(191) NULL,
  `cancellationReason` VARCHAR(500) NULL,
  `correctsRecordId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_overtime_records_tenantId_employeeId_attendanceDate_key` (`tenantId`, `employeeId`, `attendanceDate`),
  INDEX `hr_overtime_records_tenantId_idx` (`tenantId`),
  INDEX `hr_overtime_records_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_overtime_records_tenantId_attendanceDate_idx` (`tenantId`, `attendanceDate`),
  INDEX `hr_overtime_records_tenantId_status_idx` (`tenantId`, `status`),
  INDEX `hr_overtime_records_tenantId_attendanceDayId_idx` (`tenantId`, `attendanceDayId`),
  INDEX `hr_overtime_records_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `hr_overtime_records_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_overtime_records_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_overtime_records_attendanceDayId_fkey`
    FOREIGN KEY (`attendanceDayId`) REFERENCES `hr_attendance_days` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `hr_overtime_records_shiftId_fkey`
    FOREIGN KEY (`shiftId`) REFERENCES `hr_shift_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
