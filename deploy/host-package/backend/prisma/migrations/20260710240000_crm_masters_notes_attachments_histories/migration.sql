-- CRM masters, entity notes/attachments, opportunity history tables

CREATE TABLE `crm_masters` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(64) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `attributes` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `crm_masters_tenantId_kind_code_key`(`tenantId`, `kind`, `code`),
    INDEX `crm_masters_tenantId_kind_idx`(`tenantId`, `kind`),
    INDEX `crm_masters_tenantId_kind_status_idx`(`tenantId`, `kind`, `status`),
    INDEX `crm_masters_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_notes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_notes_tenantId_entityType_entityId_idx`(`tenantId`, `entityType`, `entityId`),
    INDEX `crm_notes_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(500) NOT NULL,
    `storedFilename` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `fileSize` INTEGER NOT NULL DEFAULT 0,
    `storageKey` VARCHAR(500) NOT NULL,
    `documentType` VARCHAR(64) NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_attachments_tenantId_entityType_entityId_idx`(`tenantId`, `entityType`, `entityId`),
    INDEX `crm_attachments_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_opportunity_stage_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `fromStageId` VARCHAR(191) NULL,
    `toStageId` VARCHAR(191) NOT NULL,
    `changedBy` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_opportunity_stage_history_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_opportunity_assignment_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `fromOwnerId` VARCHAR(191) NULL,
    `toOwnerId` VARCHAR(191) NULL,
    `changedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_opportunity_assignment_history_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_opportunity_amount_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `oldAmount` DECIMAL(18, 2) NOT NULL,
    `newAmount` DECIMAL(18, 2) NOT NULL,
    `changedBy` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_opportunity_amount_history_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_opportunity_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(32) NULL,
    `toStatus` VARCHAR(32) NOT NULL,
    `changedBy` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_opportunity_status_history_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `crm_masters` ADD CONSTRAINT `crm_masters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `crm_notes` ADD CONSTRAINT `crm_notes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `crm_attachments` ADD CONSTRAINT `crm_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
