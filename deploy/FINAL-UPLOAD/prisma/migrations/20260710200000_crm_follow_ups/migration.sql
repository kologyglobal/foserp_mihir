-- CreateTable
CREATE TABLE `crm_follow_ups` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `followUpType` VARCHAR(64) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `dueDate` DATE NOT NULL,
    `dueTime` VARCHAR(8) NOT NULL DEFAULT '10:00',
    `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `outcome` TEXT NULL,
    `notes` TEXT NULL,
    `reminder` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_follow_ups_tenantId_idx`(`tenantId`),
    INDEX `crm_follow_ups_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_follow_ups_tenantId_assignedTo_idx`(`tenantId`, `assignedTo`),
    INDEX `crm_follow_ups_tenantId_dueDate_idx`(`tenantId`, `dueDate`),
    INDEX `crm_follow_ups_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_follow_ups_tenantId_leadId_idx`(`tenantId`, `leadId`),
    INDEX `crm_follow_ups_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crm_follow_ups` ADD CONSTRAINT `crm_follow_ups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
