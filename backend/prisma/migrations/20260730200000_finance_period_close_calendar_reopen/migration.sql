-- Period Close ops: checklist templates, calendar events, reopen-request approval.

CREATE TABLE `period_close_checklist_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `module` ENUM('SALES_AR', 'PURCHASE_AP', 'INVENTORY', 'MANUFACTURING', 'FIXED_ASSETS', 'BANK_CASH', 'GST_TDS', 'GENERAL_LEDGER') NOT NULL,
    `defaultOwnerRole` VARCHAR(64) NULL,
    `defaultDueOffsetDays` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `blocksClose` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `period_close_checklist_templates_legalEntityId_code_key`(`legalEntityId`, `code`),
    INDEX `period_close_checklist_templates_tenantId_idx`(`tenantId`),
    INDEX `period_close_checklist_templates_legalEntityId_isActive_idx`(`legalEntityId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `period_close_checklist_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `title` VARCHAR(200) NOT NULL,
    `module` ENUM('SALES_AR', 'PURCHASE_AP', 'INVENTORY', 'MANUFACTURING', 'FIXED_ASSETS', 'BANK_CASH', 'GST_TDS', 'GENERAL_LEDGER') NOT NULL,
    `ownerLabel` VARCHAR(120) NULL,
    `reviewerLabel` VARCHAR(120) NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'READY_FOR_REVIEW', 'COMPLETED', 'REOPENED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_STARTED',
    `completionPct` INTEGER NOT NULL DEFAULT 0,
    `evidence` VARCHAR(500) NULL,
    `comments` VARCHAR(1000) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `period_close_checklist_tasks_tenantId_idx`(`tenantId`),
    INDEX `period_close_checklist_tasks_periodId_status_idx`(`periodId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `period_close_calendar_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` ENUM('CHECKLIST', 'RECONCILIATION', 'LOCK', 'YEAR_END', 'REVIEW', 'OTHER') NOT NULL,
    `dueDate` DATE NOT NULL,
    `ownerLabel` VARCHAR(120) NULL,
    `status` ENUM('UPCOMING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'COMPLETED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'UPCOMING',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `period_close_calendar_events_tenantId_idx`(`tenantId`),
    INDEX `period_close_calendar_events_periodId_dueDate_idx`(`periodId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `period_reopen_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `requestNumber` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'OPEN_TEMPORARILY', 'EXPIRED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `moduleLabel` VARCHAR(64) NOT NULL,
    `reasonCode` ENUM('INCORRECT_ACCOUNT', 'INCORRECT_AMOUNT', 'DUPLICATE_ENTRY', 'WRONG_PARTY', 'WRONG_POSTING_DATE', 'CANCELLED_TRANSACTION', 'OTHER') NOT NULL,
    `reasonDetail` VARCHAR(500) NULL,
    `documentRef` VARCHAR(64) NULL,
    `riskExplanation` VARCHAR(2000) NOT NULL,
    `requestedUntil` DATE NOT NULL,
    `requestedBy` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedBy` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(500) NULL,
    `openedAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `period_reopen_requests_tenantId_requestNumber_key`(`tenantId`, `requestNumber`),
    INDEX `period_reopen_requests_tenantId_idx`(`tenantId`),
    INDEX `period_reopen_requests_legalEntityId_status_idx`(`legalEntityId`, `status`),
    INDEX `period_reopen_requests_periodId_status_idx`(`periodId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `period_reopen_request_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `byUserId` VARCHAR(191) NULL,
    `byLabel` VARCHAR(120) NULL,
    `action` VARCHAR(64) NOT NULL,
    `note` VARCHAR(1000) NULL,

    INDEX `period_reopen_request_events_requestId_at_idx`(`requestId`, `at`),
    INDEX `period_reopen_request_events_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `period_close_checklist_templates` ADD CONSTRAINT `period_close_checklist_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_checklist_templates` ADD CONSTRAINT `period_close_checklist_templates_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `period_close_checklist_tasks` ADD CONSTRAINT `period_close_checklist_tasks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_checklist_tasks` ADD CONSTRAINT `period_close_checklist_tasks_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_checklist_tasks` ADD CONSTRAINT `period_close_checklist_tasks_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_checklist_tasks` ADD CONSTRAINT `period_close_checklist_tasks_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `period_close_checklist_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `period_close_calendar_events` ADD CONSTRAINT `period_close_calendar_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_calendar_events` ADD CONSTRAINT `period_close_calendar_events_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_close_calendar_events` ADD CONSTRAINT `period_close_calendar_events_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `period_reopen_requests` ADD CONSTRAINT `period_reopen_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_reopen_requests` ADD CONSTRAINT `period_reopen_requests_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_reopen_requests` ADD CONSTRAINT `period_reopen_requests_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `period_reopen_request_events` ADD CONSTRAINT `period_reopen_request_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `period_reopen_request_events` ADD CONSTRAINT `period_reopen_request_events_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `period_reopen_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
