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
    `entityType` ENUM('USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER') NOT NULL,
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

-- CreateTable
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

    INDEX `crm_masters_tenantId_kind_idx`(`tenantId`, `kind`),
    INDEX `crm_masters_tenantId_kind_status_idx`(`tenantId`, `kind`, `status`),
    INDEX `crm_masters_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_masters_tenantId_kind_code_key`(`tenantId`, `kind`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_notes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP', 'QUOTATION') NOT NULL,
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

-- CreateTable
CREATE TABLE `crm_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP', 'QUOTATION') NOT NULL,
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE `crm_quotations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `quotationCode` VARCHAR(32) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `qty` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `validityDate` DATE NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `revisionNo` INTEGER NOT NULL DEFAULT 1,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `terms` TEXT NULL,
    `paymentTerms` VARCHAR(500) NULL,
    `deliveryTerms` VARCHAR(500) NULL,
    `locationId` VARCHAR(191) NULL,
    `pricing` JSON NOT NULL,
    `changeHistory` JSON NOT NULL,
    `customerApproval` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `customerApprovalAt` DATETIME(3) NULL,
    `customerApprovalBy` VARCHAR(191) NULL,
    `customerRejectionReason` TEXT NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `salesOrderNo` VARCHAR(64) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_quotations_tenantId_idx`(`tenantId`),
    INDEX `crm_quotations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_quotations_tenantId_companyId_idx`(`tenantId`, `companyId`),
    INDEX `crm_quotations_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    INDEX `crm_quotations_tenantId_salesOwnerId_idx`(`tenantId`, `salesOwnerId`),
    UNIQUE INDEX `crm_quotations_tenantId_quotationCode_key`(`tenantId`, `quotationCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_quotation_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `templateName` VARCHAR(200) NOT NULL,
    `productFamily` VARCHAR(100) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `sections` JSON NOT NULL,
    `defaultTerms` TEXT NOT NULL DEFAULT '',
    `defaultWarranty` TEXT NOT NULL DEFAULT '',
    `defaultExclusions` TEXT NOT NULL DEFAULT '',
    `printLayout` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_quotation_templates_tenantId_idx`(`tenantId`),
    INDEX `crm_quotation_templates_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `crm_quotation_templates_tenantId_isActive_idx`(`tenantId`, `isActive`),
    INDEX `crm_quotation_templates_tenantId_productFamily_idx`(`tenantId`, `productFamily`),
    UNIQUE INDEX `crm_quotation_templates_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_quotation_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `revisionNo` INTEGER NOT NULL DEFAULT 1,
    `templateId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `installationAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `customCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `revisionReason` TEXT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `approvalHistory` JSON NOT NULL,
    `sections` JSON NOT NULL,
    `priceLines` JSON NOT NULL,
    `commercialNotes` TEXT NULL,
    `technicalNotes` TEXT NULL,
    `locationId` VARCHAR(191) NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `salesOrderNo` VARCHAR(64) NULL,
    `contactId` VARCHAR(191) NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdByName` VARCHAR(200) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_quotation_documents_tenantId_idx`(`tenantId`),
    INDEX `crm_quotation_documents_tenantId_quotationId_idx`(`tenantId`, `quotationId`),
    INDEX `crm_quotation_documents_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_quotation_documents_tenantId_salesOwnerId_idx`(`tenantId`, `salesOwnerId`),
    INDEX `crm_quotation_documents_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_quotation_documents_tenantId_quotationId_revisionNo_key`(`tenantId`, `quotationId`, `revisionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_sales_orders` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `salesOrderNo` VARCHAR(64) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `qty` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `status` VARCHAR(32) NOT NULL DEFAULT 'open',
    `source` VARCHAR(32) NOT NULL DEFAULT 'quotation',
    `orderDate` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requiredDate` DATE NULL,
    `expectedDeliveryDate` DATE NULL,
    `remarks` TEXT NULL,
    `quotationId` VARCHAR(191) NULL,
    `quotationNo` VARCHAR(64) NULL,
    `quotationRevisionNo` INTEGER NULL,
    `quotationDocumentId` VARCHAR(191) NULL,
    `quotationDocumentRevisionNo` INTEGER NULL,
    `opportunityId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(18, 2) NULL,
    `discountPct` DECIMAL(5, 2) NULL,
    `grandTotal` DECIMAL(18, 2) NULL,
    `basicAmount` DECIMAL(18, 2) NULL,
    `gstAmount` DECIMAL(18, 2) NULL,
    `paymentTerms` VARCHAR(500) NULL,
    `deliveryTerms` VARCHAR(500) NULL,
    `warrantyTerms` VARCHAR(500) NULL,
    `commercialNotes` TEXT NULL,
    `technicalNotes` TEXT NULL,
    `customerCode` VARCHAR(64) NULL,
    `customerPoNumber` VARCHAR(100) NULL,
    `customerPoDate` DATE NULL,
    `deliveryLocation` VARCHAR(500) NULL,
    `billingAddress` TEXT NULL,
    `shippingAddress` TEXT NULL,
    `salesOwnerId` VARCHAR(191) NULL,
    `salesOwnerName` VARCHAR(200) NULL,
    `internalRemarks` TEXT NULL,
    `locationId` VARCHAR(191) NULL,
    `lines` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `crm_sales_orders_tenantId_idx`(`tenantId`),
    INDEX `crm_sales_orders_tenantId_companyId_idx`(`tenantId`, `companyId`),
    INDEX `crm_sales_orders_tenantId_quotationId_idx`(`tenantId`, `quotationId`),
    INDEX `crm_sales_orders_tenantId_opportunityId_idx`(`tenantId`, `opportunityId`),
    INDEX `crm_sales_orders_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `crm_sales_orders_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `crm_sales_orders_tenantId_salesOrderNo_key`(`tenantId`, `salesOrderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_countries` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_countries_tenantId_idx`(`tenantId`),
    INDEX `master_countries_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_countries_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_countries_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_states` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_states_tenantId_idx`(`tenantId`),
    INDEX `master_states_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_states_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_states_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_cities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `stateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_cities_tenantId_idx`(`tenantId`),
    INDEX `master_cities_tenantId_stateId_idx`(`tenantId`, `stateId`),
    INDEX `master_cities_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_cities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_cities_tenantId_stateId_name_key`(`tenantId`, `stateId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_products` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `productFamily` VARCHAR(64) NOT NULL DEFAULT 'bulker_trailer',
    `productType` VARCHAR(32) NOT NULL DEFAULT 'bulker',
    `fgItemId` VARCHAR(64) NULL,
    `capacity` VARCHAR(100) NOT NULL DEFAULT '',
    `axleConfig` VARCHAR(100) NOT NULL DEFAULT '',
    `tareWeightKg` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gvwKg` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `standardPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `standardLeadDays` INTEGER NOT NULL DEFAULT 0,
    `baseUomId` VARCHAR(64) NULL,
    `hsnCode` VARCHAR(16) NOT NULL DEFAULT '',
    `specifications` TEXT NOT NULL DEFAULT '',
    `productStatus` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `details` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_products_tenantId_idx`(`tenantId`),
    INDEX `master_products_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_products_tenantId_productStatus_idx`(`tenantId`, `productStatus`),
    INDEX `master_products_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_products_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_uoms` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `uomType` VARCHAR(32) NOT NULL DEFAULT 'integer',
    `decimalPlaces` INTEGER NOT NULL DEFAULT 0,
    `isBaseUnit` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_uoms_tenantId_idx`(`tenantId`),
    INDEX `master_uoms_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_uoms_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_uoms_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_warehouses` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `warehouseType` VARCHAR(32) NOT NULL DEFAULT 'main',
    `plantCode` VARCHAR(32) NOT NULL DEFAULT 'PUNE',
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_warehouses_tenantId_idx`(`tenantId`),
    INDEX `master_warehouses_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_warehouses_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_warehouses_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_locations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `addressLine1` VARCHAR(300) NULL,
    `addressLine2` VARCHAR(300) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(16) NULL,
    `country` VARCHAR(100) NULL,
    `gstin` VARCHAR(15) NULL,
    `registeredType` VARCHAR(64) NULL,
    `allowSales` BOOLEAN NOT NULL DEFAULT true,
    `allowPurchase` BOOLEAN NOT NULL DEFAULT true,
    `allowProduction` BOOLEAN NOT NULL DEFAULT true,
    `allowInventory` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_locations_tenantId_idx`(`tenantId`),
    INDEX `master_locations_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `master_locations_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_locations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_locations_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_item_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_item_categories_tenantId_idx`(`tenantId`),
    INDEX `master_item_categories_tenantId_parentId_idx`(`tenantId`, `parentId`),
    INDEX `master_item_categories_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_item_categories_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_item_categories_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_gst_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `goodsType` VARCHAR(16) NOT NULL DEFAULT 'goods',
    `description` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_gst_groups_tenantId_idx`(`tenantId`),
    INDEX `master_gst_groups_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_gst_groups_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_gst_groups_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_hsn_codes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `gstGroupId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_hsn_codes_tenantId_idx`(`tenantId`),
    INDEX `master_hsn_codes_tenantId_gstGroupId_idx`(`tenantId`, `gstGroupId`),
    INDEX `master_hsn_codes_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_hsn_codes_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_hsn_codes_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_gst_rates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `gstGroupId` VARCHAR(191) NOT NULL,
    `fromState` VARCHAR(100) NOT NULL,
    `locationStateCode` VARCHAR(100) NOT NULL,
    `dateFrom` DATE NOT NULL,
    `dateTo` DATE NULL,
    `sgst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `cgst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `igst` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_gst_rates_tenantId_idx`(`tenantId`),
    INDEX `master_gst_rates_tenantId_gstGroupId_idx`(`tenantId`, `gstGroupId`),
    INDEX `master_gst_rates_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_gst_rates_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_gst_rates_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `itemName2` VARCHAR(300) NULL,
    `itemDescription` TEXT NOT NULL DEFAULT '',
    `categoryId` VARCHAR(191) NOT NULL,
    `baseUomId` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(32) NOT NULL,
    `productType` VARCHAR(32) NULL,
    `inventoryType` VARCHAR(32) NULL DEFAULT 'inventory',
    `codeSeriesMode` VARCHAR(16) NULL DEFAULT 'manual',
    `materialGrade` VARCHAR(100) NOT NULL DEFAULT '',
    `hsnCode` VARCHAR(16) NOT NULL DEFAULT '',
    `hsnId` VARCHAR(191) NULL,
    `gstGroupId` VARCHAR(191) NULL,
    `reorderLevel` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reorderQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `standardRate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `isPurchasable` BOOLEAN NOT NULL DEFAULT true,
    `isStockable` BOOLEAN NOT NULL DEFAULT true,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `quantityPerUom` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `purchaseUomId` VARCHAR(191) NULL,
    `purchaseQtyPerUom` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `qcRequired` BOOLEAN NOT NULL DEFAULT false,
    `qualityTestGroupCode` VARCHAR(32) NULL,
    `productionBomId` VARCHAR(36) NULL,
    `routingNo` VARCHAR(64) NULL,
    `drawingNo` VARCHAR(64) NULL,
    `subAssemblyRule` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_items_tenantId_idx`(`tenantId`),
    INDEX `master_items_tenantId_categoryId_idx`(`tenantId`, `categoryId`),
    INDEX `master_items_tenantId_itemType_idx`(`tenantId`, `itemType`),
    INDEX `master_items_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_items_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `master_items_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_vendors` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `searchName` VARCHAR(50) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `address` TEXT NULL,
    `address2` VARCHAR(500) NULL,
    `city` VARCHAR(100) NOT NULL DEFAULT '',
    `state` VARCHAR(100) NOT NULL DEFAULT '',
    `pincode` VARCHAR(20) NULL,
    `country` VARCHAR(100) NULL,
    `countryId` VARCHAR(191) NULL,
    `stateId` VARCHAR(191) NULL,
    `cityId` VARCHAR(191) NULL,
    `email` VARCHAR(255) NULL,
    `gstin` VARCHAR(20) NOT NULL DEFAULT '',
    `gstVendorType` VARCHAR(32) NULL DEFAULT 'registered',
    `pan` VARCHAR(10) NULL,
    `panStatus` VARCHAR(32) NULL DEFAULT 'pan_applied',
    `paymentMethod` VARCHAR(64) NULL,
    `bankDetails` TEXT NULL,
    `vendorType` VARCHAR(32) NOT NULL DEFAULT 'manufacturer',
    `contactPerson` VARCHAR(200) NOT NULL DEFAULT '',
    `contactPhone` VARCHAR(30) NOT NULL DEFAULT '',
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 30,
    `defaultLeadTimeDays` INTEGER NOT NULL DEFAULT 7,
    `suppliedCategories` JSON NOT NULL,
    `rating` DECIMAL(3, 1) NOT NULL DEFAULT 4,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `master_vendors_tenantId_idx`(`tenantId`),
    INDEX `master_vendors_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `master_vendors_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `master_vendors_tenantId_countryId_idx`(`tenantId`, `countryId`),
    INDEX `master_vendors_tenantId_stateId_idx`(`tenantId`, `stateId`),
    INDEX `master_vendors_tenantId_cityId_idx`(`tenantId`, `cityId`),
    UNIQUE INDEX `master_vendors_tenantId_code_key`(`tenantId`, `code`),
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

-- AddForeignKey
ALTER TABLE `crm_follow_ups` ADD CONSTRAINT `crm_follow_ups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_masters` ADD CONSTRAINT `crm_masters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_notes` ADD CONSTRAINT `crm_notes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_attachments` ADD CONSTRAINT `crm_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotations` ADD CONSTRAINT `crm_quotations_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `crm_opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotation_templates` ADD CONSTRAINT `crm_quotation_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotation_documents` ADD CONSTRAINT `crm_quotation_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_quotation_documents` ADD CONSTRAINT `crm_quotation_documents_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `crm_quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_sales_orders` ADD CONSTRAINT `crm_sales_orders_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_sales_orders` ADD CONSTRAINT `crm_sales_orders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_countries` ADD CONSTRAINT `master_countries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_states` ADD CONSTRAINT `master_states_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_cities` ADD CONSTRAINT `master_cities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_products` ADD CONSTRAINT `master_products_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_uoms` ADD CONSTRAINT `master_uoms_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_warehouses` ADD CONSTRAINT `master_warehouses_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_locations` ADD CONSTRAINT `master_locations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_locations` ADD CONSTRAINT `master_locations_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `master_item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_item_categories` ADD CONSTRAINT `master_item_categories_defaultWarehouseId_fkey` FOREIGN KEY (`defaultWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_gst_groups` ADD CONSTRAINT `master_gst_groups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_hsn_codes` ADD CONSTRAINT `master_hsn_codes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_hsn_codes` ADD CONSTRAINT `master_hsn_codes_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_gst_rates` ADD CONSTRAINT `master_gst_rates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_gst_rates` ADD CONSTRAINT `master_gst_rates_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `master_item_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_baseUomId_fkey` FOREIGN KEY (`baseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_purchaseUomId_fkey` FOREIGN KEY (`purchaseUomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_hsnId_fkey` FOREIGN KEY (`hsnId`) REFERENCES `master_hsn_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_items` ADD CONSTRAINT `master_items_gstGroupId_fkey` FOREIGN KEY (`gstGroupId`) REFERENCES `master_gst_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `master_countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `master_states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_vendors` ADD CONSTRAINT `master_vendors_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `master_cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
