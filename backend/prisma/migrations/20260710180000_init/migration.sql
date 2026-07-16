-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `legalName` VARCHAR(300) NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `country` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED') NOT NULL DEFAULT 'TRIAL',
    `subscriptionPlan` VARCHAR(64) NULL,
    `subscriptionStatus` VARCHAR(64) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `tenants_slug_key`(`slug`),
    INDEX `tenants_status_idx`(`status`),
    INDEX `tenants_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `mobile` VARCHAR(20) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `designation` VARCHAR(100) NULL,
    `department` VARCHAR(100) NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED') NOT NULL DEFAULT 'INVITED',
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `users_tenantId_idx`(`tenantId`),
    INDEX `users_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `users_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `users_tenantId_email_key`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `roles_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `roles_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `module` VARCHAR(64) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    INDEX `user_roles_tenantId_idx`(`tenantId`),
    INDEX `user_roles_userId_idx`(`userId`),
    UNIQUE INDEX `user_roles_userId_roleId_key`(`userId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `role_permissions_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userAgent` VARCHAR(512) NULL,
    `ipAddress` VARCHAR(64) NULL,

    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_tenantId_idx`(`tenantId`),
    INDEX `refresh_tokens_tokenHash_idx`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_tokens_userId_idx`(`userId`),
    INDEX `password_reset_tokens_tokenHash_idx`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `module` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(36) NULL,
    `action` VARCHAR(64) NOT NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenantId_idx`(`tenantId`),
    INDEX `audit_logs_tenantId_module_idx`(`tenantId`, `module`),
    INDEX `audit_logs_tenantId_entity_entityId_idx`(`tenantId`, `entity`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `code_series` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY') NOT NULL,
    `prefix` VARCHAR(20) NOT NULL,
    `currentValue` INTEGER NOT NULL DEFAULT 0,
    `padLength` INTEGER NOT NULL DEFAULT 6,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `code_series_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `code_series_tenantId_entityType_key`(`tenantId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_companies` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `companyCode` VARCHAR(32) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `customerType` VARCHAR(32) NOT NULL DEFAULT 'corporate',
    `website` VARCHAR(255) NULL,
    `industry` VARCHAR(100) NULL,
    `turnoverRange` VARCHAR(64) NULL,
    `employeeRange` VARCHAR(64) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `addressLine1` VARCHAR(500) NULL,
    `addressLine2` VARCHAR(500) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(20) NULL,
    `country` VARCHAR(100) NULL DEFAULT 'India',
    `gstin` VARCHAR(20) NULL,
    `pan` VARCHAR(20) NULL,
    `contactPerson` VARCHAR(200) NULL,
    `contactPhone` VARCHAR(30) NULL,
    `contactEmail` VARCHAR(255) NULL,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `creditLimit` DECIMAL(18, 2) NULL,
    `salesTerritory` VARCHAR(32) NULL,
    `source` VARCHAR(64) NULL,
    `ownerId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_companies_tenantId_idx`(`tenantId`),
    INDEX `crm_companies_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_companies_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_companies_tenantId_name_idx`(`tenantId`, `name`),
    UNIQUE INDEX `crm_companies_tenantId_companyCode_key`(`tenantId`, `companyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `contactCode` VARCHAR(32) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL DEFAULT '',
    `designation` VARCHAR(100) NULL,
    `department` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `mobile` VARCHAR(20) NULL,
    `alternateMobile` VARCHAR(20) NULL,
    `linkedInUrl` VARCHAR(255) NULL,
    `ownerId` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `masterContactId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_contacts_tenantId_idx`(`tenantId`),
    INDEX `crm_contacts_tenantId_companyId_idx`(`tenantId`, `companyId`),
    INDEX `crm_contacts_tenantId_email_idx`(`tenantId`, `email`),
    INDEX `crm_contacts_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_contacts_tenantId_contactCode_key`(`tenantId`, `contactCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_leads` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `leadCode` VARCHAR(32) NOT NULL,
    `prospectName` VARCHAR(300) NOT NULL,
    `companyName` VARCHAR(300) NULL,
    `companyId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `designation` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `mobile` VARCHAR(20) NULL,
    `contactPerson` VARCHAR(200) NULL,
    `source` VARCHAR(64) NOT NULL DEFAULT 'other',
    `industry` VARCHAR(100) NULL,
    `turnoverRange` VARCHAR(64) NULL,
    `productRequirement` TEXT NULL,
    `expectedQty` INTEGER NULL,
    `expectedValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `probability` INTEGER NOT NULL DEFAULT 0,
    `stage` VARCHAR(64) NOT NULL DEFAULT 'new',
    `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
    `lifecycleStatus` VARCHAR(32) NOT NULL DEFAULT 'open',
    `activityStatus` VARCHAR(32) NOT NULL DEFAULT 'active',
    `qualificationStatus` VARCHAR(32) NULL,
    `temperature` VARCHAR(16) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `lastContactedAt` DATETIME(3) NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `expectedCloseDate` DATETIME(3) NULL,
    `inactiveReason` VARCHAR(64) NULL,
    `notQualifiedReason` VARCHAR(64) NULL,
    `closedReason` VARCHAR(64) NULL,
    `closedDate` DATETIME(3) NULL,
    `lostReason` TEXT NULL,
    `remarks` TEXT NULL,
    `followUpType` VARCHAR(64) NULL,
    `followUpNotes` TEXT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `convertedAt` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `locationId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_leads_tenantId_idx`(`tenantId`),
    INDEX `crm_leads_tenantId_stage_idx`(`tenantId`, `stage`),
    INDEX `crm_leads_tenantId_assignedTo_idx`(`tenantId`, `assignedTo`),
    INDEX `crm_leads_tenantId_ownerId_idx`(`tenantId`, `ownerId`),
    INDEX `crm_leads_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `crm_leads_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_leads_tenantId_leadCode_key`(`tenantId`, `leadCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_lead_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `fromStage` VARCHAR(64) NULL,
    `toStage` VARCHAR(64) NOT NULL,
    `changedBy` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_lead_status_history_tenantId_leadId_idx`(`tenantId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_lead_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `assignedTo` VARCHAR(191) NOT NULL,
    `assignedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crm_lead_assignments_tenantId_leadId_idx`(`tenantId`, `leadId`),
    INDEX `crm_lead_assignments_tenantId_assignedTo_idx`(`tenantId`, `assignedTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_activities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `activityType` ENUM('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'FOLLOW_UP', 'NOTE', 'DEMO', 'TASK', 'SITE_VISIT', 'STAGE_CHANGE') NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `priority` VARCHAR(32) NULL,
    `status` ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE') NOT NULL DEFAULT 'PLANNED',
    `outcome` TEXT NULL,
    `nextAction` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_activities_tenantId_idx`(`tenantId`),
    INDEX `crm_activities_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_activities_tenantId_leadId_idx`(`tenantId`, `leadId`),
    INDEX `crm_activities_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    INDEX `crm_activities_tenantId_assignedTo_idx`(`tenantId`, `assignedTo`),
    INDEX `crm_activities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_pipelines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_pipelines_tenantId_idx`(`tenantId`),
    INDEX `crm_pipelines_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_pipeline_stages` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `pipelineId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `probability` INTEGER NOT NULL DEFAULT 0,
    `isClosedWon` BOOLEAN NOT NULL DEFAULT false,
    `isClosedLost` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_pipeline_stages_tenantId_pipelineId_idx`(`tenantId`, `pipelineId`),
    UNIQUE INDEX `crm_pipeline_stages_tenantId_pipelineId_slug_key`(`tenantId`, `pipelineId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_opportunities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityCode` VARCHAR(32) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `pipelineId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `expectedCloseDate` DATETIME(3) NULL,
    `probability` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'WON', 'LOST', 'ON_HOLD', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    `requirement` TEXT NULL,
    `competitor` VARCHAR(200) NULL,
    `winReason` TEXT NULL,
    `lostReason` TEXT NULL,
    `healthScore` INTEGER NOT NULL DEFAULT 60,
    `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
    `lastActivityAt` DATETIME(3) NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `locationId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_opportunities_tenantId_idx`(`tenantId`),
    INDEX `crm_opportunities_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_opportunities_tenantId_stageId_idx`(`tenantId`, `stageId`),
    INDEX `crm_opportunities_tenantId_ownerId_idx`(`tenantId`, `ownerId`),
    INDEX `crm_opportunities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_opportunities_tenantId_opportunityCode_key`(`tenantId`, `opportunityCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_opportunity_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `productId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCode` VARCHAR(64) NOT NULL DEFAULT '',
    `productOrItem` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `productFamily` VARCHAR(100) NULL,
    `itemType` VARCHAR(64) NULL,
    `qty` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `uom` VARCHAR(16) NOT NULL DEFAULT 'NOS',
    `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxableValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `gstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `expectedDeliveryDate` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `crm_opportunity_lines_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `code_series` ADD CONSTRAINT `code_series_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_companies` ADD CONSTRAINT `crm_companies_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contacts` ADD CONSTRAINT `crm_contacts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contacts` ADD CONSTRAINT `crm_contacts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_leads` ADD CONSTRAINT `crm_leads_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_status_history` ADD CONSTRAINT `crm_lead_status_history_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_lead_assignments` ADD CONSTRAINT `crm_lead_assignments_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `crm_opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_pipelines` ADD CONSTRAINT `crm_pipelines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_pipeline_stages` ADD CONSTRAINT `crm_pipeline_stages_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_pipeline_stages` ADD CONSTRAINT `crm_pipeline_stages_pipelineId_fkey` FOREIGN KEY (`pipelineId`) REFERENCES `crm_pipelines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_pipelineId_fkey` FOREIGN KEY (`pipelineId`) REFERENCES `crm_pipelines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `crm_pipeline_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunity_lines` ADD CONSTRAINT `crm_opportunity_lines_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `crm_opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

