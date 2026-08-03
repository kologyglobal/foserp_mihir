-- Maintenance V2: Preventive Maintenance plans + ticket checklist execution

ALTER TABLE `maintenance_tickets`
  MODIFY COLUMN `sourceType` ENUM(
    'MANUAL',
    'MY_WORK',
    'WORK_ORDER',
    'JOB_CARD',
    'OPERATION',
    'PREVENTIVE'
  ) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE `maintenance_tickets`
  ADD COLUMN `preventiveMaintenancePlanId` VARCHAR(191) NULL,
  ADD COLUMN `pmScheduledDueDate` DATE NULL,
  ADD COLUMN `scheduledDate` DATE NULL;

CREATE INDEX `maintenance_tickets_tenantId_preventiveMaintenancePlanId_idx`
  ON `maintenance_tickets` (`tenantId`, `preventiveMaintenancePlanId`);

CREATE INDEX `maintenance_tickets_tenantId_sourceType_idx`
  ON `maintenance_tickets` (`tenantId`, `sourceType`);

CREATE TABLE `preventive_maintenance_plans` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `planNumber` VARCHAR(32) NOT NULL,
  `machineId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `frequencyType` ENUM('DAYS', 'WEEKS', 'MONTHS') NOT NULL,
  `frequencyValue` INTEGER NOT NULL,
  `startDate` DATE NOT NULL,
  `lastCompletedDate` DATE NULL,
  `nextDueDate` DATE NOT NULL,
  `assignedTechnicianId` VARCHAR(191) NULL,
  `assignedContractorId` VARCHAR(191) NULL,
  `estimatedDurationMin` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `preventive_maintenance_plans_tenantId_planNumber_key` (`tenantId`, `planNumber`),
  INDEX `preventive_maintenance_plans_tenantId_idx` (`tenantId`),
  INDEX `preventive_maintenance_plans_tenantId_machineId_idx` (`tenantId`, `machineId`),
  INDEX `preventive_maintenance_plans_tenantId_nextDueDate_idx` (`tenantId`, `nextDueDate`),
  INDEX `preventive_maintenance_plans_tenantId_isActive_idx` (`tenantId`, `isActive`),
  INDEX `preventive_maintenance_plans_tenantId_deletedAt_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `preventive_maintenance_plans_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `preventive_maintenance_plans_machineId_fkey`
    FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `preventive_maintenance_plans_assignedContractorId_fkey`
    FOREIGN KEY (`assignedContractorId`) REFERENCES `master_vendors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `preventive_maintenance_checklist_items` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `planId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `text` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `preventive_maintenance_checklist_items_planId_sequence_key` (`planId`, `sequence`),
  INDEX `preventive_maintenance_checklist_items_tenantId_idx` (`tenantId`),
  INDEX `preventive_maintenance_checklist_items_planId_idx` (`planId`),
  CONSTRAINT `preventive_maintenance_checklist_items_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `preventive_maintenance_checklist_items_planId_fkey`
    FOREIGN KEY (`planId`) REFERENCES `preventive_maintenance_plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `maintenance_ticket_checklist_items` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `text` VARCHAR(500) NOT NULL,
  `isDone` BOOLEAN NOT NULL DEFAULT false,
  `remark` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `maintenance_ticket_checklist_items_ticketId_sequence_key` (`ticketId`, `sequence`),
  INDEX `maintenance_ticket_checklist_items_tenantId_idx` (`tenantId`),
  INDEX `maintenance_ticket_checklist_items_ticketId_idx` (`ticketId`),
  CONSTRAINT `maintenance_ticket_checklist_items_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `maintenance_ticket_checklist_items_ticketId_fkey`
    FOREIGN KEY (`ticketId`) REFERENCES `maintenance_tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `maintenance_tickets`
  ADD CONSTRAINT `maintenance_tickets_preventiveMaintenancePlanId_fkey`
    FOREIGN KEY (`preventiveMaintenancePlanId`) REFERENCES `preventive_maintenance_plans` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
