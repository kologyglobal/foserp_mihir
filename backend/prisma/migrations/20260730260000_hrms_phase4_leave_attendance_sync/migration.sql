-- HRMS Phase 4 — Leave attendance sync + minimal attendance read model
-- Extends leave requests with approvedByEmployeeId; adds day/punch/exception tables.

ALTER TABLE `hr_leave_requests`
  ADD COLUMN `approvedByEmployeeId` VARCHAR(191) NULL AFTER `approvedByUserId`;

CREATE TABLE IF NOT EXISTS `hr_attendance_days` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `attendanceDate` DATE NOT NULL,
  `status` ENUM('PRESENT','ABSENT','LEAVE','HALF_DAY','WEEKLY_OFF','HOLIDAY','ON_DUTY') NOT NULL,
  `leaveRequestId` VARCHAR(191) NULL,
  `leaveDurationType` ENUM('FULL_DAY','FIRST_HALF','SECOND_HALF') NULL,
  `leaveTypeCode` VARCHAR(32) NULL,
  `hasPunch` BOOLEAN NOT NULL DEFAULT false,
  `exceptionFlag` BOOLEAN NOT NULL DEFAULT false,
  `exceptionReason` VARCHAR(500) NULL,
  `source` VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
  `note` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_attendance_days_tenantId_employeeId_attendanceDate_key` (`tenantId`, `employeeId`, `attendanceDate`),
  INDEX `hr_attendance_days_tenantId_idx` (`tenantId`),
  INDEX `hr_attendance_days_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_attendance_days_tenantId_attendanceDate_idx` (`tenantId`, `attendanceDate`),
  INDEX `hr_attendance_days_tenantId_leaveRequestId_idx` (`tenantId`, `leaveRequestId`),
  CONSTRAINT `hr_attendance_days_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_attendance_days_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_attendance_days_leaveRequestId_fkey`
    FOREIGN KEY (`leaveRequestId`) REFERENCES `hr_leave_requests` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_attendance_punches` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `punchedAt` DATETIME(3) NOT NULL,
  `punchType` ENUM('IN','OUT') NOT NULL,
  `source` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  `deviceRef` VARCHAR(120) NULL,
  `note` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `hr_attendance_punches_tenantId_idx` (`tenantId`),
  INDEX `hr_attendance_punches_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_attendance_punches_tenantId_employeeId_punchedAt_idx` (`tenantId`, `employeeId`, `punchedAt`),
  CONSTRAINT `hr_attendance_punches_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_attendance_punches_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_attendance_exceptions` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `attendanceDate` DATE NOT NULL,
  `exceptionType` ENUM('PUNCH_ON_LEAVE','PUNCH_ON_HALF_DAY_LEAVE','OTHER') NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `leaveRequestId` VARCHAR(191) NULL,
  `punchId` VARCHAR(191) NULL,
  `resolved` BOOLEAN NOT NULL DEFAULT false,
  `resolvedAt` DATETIME(3) NULL,
  `resolvedBy` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_attendance_exceptions_tenantId_idx` (`tenantId`),
  INDEX `hr_attendance_exceptions_tenantId_employeeId_idx` (`tenantId`, `employeeId`),
  INDEX `hr_attendance_exceptions_tenantId_attendanceDate_idx` (`tenantId`, `attendanceDate`),
  INDEX `hr_attendance_exceptions_tenantId_leaveRequestId_idx` (`tenantId`, `leaveRequestId`),
  INDEX `hr_attendance_exceptions_tenantId_resolved_idx` (`tenantId`, `resolved`),
  CONSTRAINT `hr_attendance_exceptions_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hr_attendance_exceptions_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `hr_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hr_attendance_exceptions_leaveRequestId_fkey`
    FOREIGN KEY (`leaveRequestId`) REFERENCES `hr_leave_requests` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
