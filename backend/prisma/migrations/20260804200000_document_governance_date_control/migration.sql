-- Document Governance — Date Control configuration framework (no live enforcement).

CREATE TABLE `document_date_policy_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `futureDateMode` VARCHAR(32) NOT NULL DEFAULT 'CURRENT_BEHAVIOUR',
    `pastDateMode` VARCHAR(32) NOT NULL DEFAULT 'CURRENT_BEHAVIOUR',
    `maxFutureDays` INTEGER NULL,
    `maxBackDateDays` INTEGER NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `allowEmergencyOverride` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `document_date_policies` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(36) NULL,
    `branchId` VARCHAR(36) NULL,
    `moduleKey` VARCHAR(64) NOT NULL,
    `documentType` VARCHAR(64) NOT NULL,
    `policyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `futureDateMode` VARCHAR(32) NOT NULL DEFAULT 'CURRENT_BEHAVIOUR',
    `pastDateMode` VARCHAR(32) NOT NULL DEFAULT 'CURRENT_BEHAVIOUR',
    `maxFutureDays` INTEGER NULL,
    `maxBackDateDays` INTEGER NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `allowEmergencyOverride` BOOLEAN NOT NULL DEFAULT false,
    `policyProfile` VARCHAR(32) NULL,
    `profileId` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `document_date_policy_allowances` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(32) NOT NULL,
    `roleId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `document_date_exception_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(64) NOT NULL,
    `documentType` VARCHAR(64) NOT NULL,
    `documentId` VARCHAR(36) NULL,
    `requestedDocumentDate` DATE NOT NULL,
    `businessDate` DATE NOT NULL,
    `requestType` VARCHAR(32) NOT NULL,
    `reason` TEXT NOT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `policySnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `document_date_policy_profiles_tenantId_code_key` ON `document_date_policy_profiles`(`tenantId`, `code`);
CREATE INDEX `document_date_policy_profiles_tenantId_idx` ON `document_date_policy_profiles`(`tenantId`);
CREATE INDEX `document_date_policy_profiles_tenantId_active_idx` ON `document_date_policy_profiles`(`tenantId`, `active`);

CREATE INDEX `document_date_policies_tenantId_idx` ON `document_date_policies`(`tenantId`);
CREATE INDEX `document_date_policies_tenantId_moduleKey_documentType_idx` ON `document_date_policies`(`tenantId`, `moduleKey`, `documentType`);
CREATE INDEX `document_date_policies_tenantId_active_policyEnabled_idx` ON `document_date_policies`(`tenantId`, `active`, `policyEnabled`);
CREATE INDEX `document_date_policies_tenantId_legalEntityId_branchId_idx` ON `document_date_policies`(`tenantId`, `legalEntityId`, `branchId`);
CREATE INDEX `document_date_policies_profileId_idx` ON `document_date_policies`(`profileId`);

CREATE UNIQUE INDEX `document_date_policy_allowances_policyId_kind_roleId_userId_key` ON `document_date_policy_allowances`(`policyId`, `kind`, `roleId`, `userId`);
CREATE INDEX `document_date_policy_allowances_tenantId_idx` ON `document_date_policy_allowances`(`tenantId`);
CREATE INDEX `document_date_policy_allowances_policyId_idx` ON `document_date_policy_allowances`(`policyId`);
CREATE INDEX `document_date_policy_allowances_tenantId_kind_idx` ON `document_date_policy_allowances`(`tenantId`, `kind`);

CREATE INDEX `document_date_exception_requests_tenantId_idx` ON `document_date_exception_requests`(`tenantId`);
CREATE INDEX `document_date_exception_requests_tenantId_status_idx` ON `document_date_exception_requests`(`tenantId`, `status`);
CREATE INDEX `doc_date_exc_req_tenant_mod_type_idx` ON `document_date_exception_requests`(`tenantId`, `moduleKey`, `documentType`);
CREATE INDEX `document_date_exception_requests_tenantId_documentId_idx` ON `document_date_exception_requests`(`tenantId`, `documentId`);

ALTER TABLE `document_date_policy_profiles` ADD CONSTRAINT `document_date_policy_profiles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_policies` ADD CONSTRAINT `document_date_policies_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_policies` ADD CONSTRAINT `document_date_policies_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `document_date_policy_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `document_date_policy_allowances` ADD CONSTRAINT `document_date_policy_allowances_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_policy_allowances` ADD CONSTRAINT `document_date_policy_allowances_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `document_date_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_policy_allowances` ADD CONSTRAINT `document_date_policy_allowances_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_policy_allowances` ADD CONSTRAINT `document_date_policy_allowances_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_date_exception_requests` ADD CONSTRAINT `document_date_exception_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
