-- Finance Budgeting Phase 1 — budget versions + annual lines
CREATE TABLE `budget_versions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `kind` ENUM('ORIGINAL', 'REVISED', 'FORECAST_1', 'FORECAST_2', 'BEST_CASE', 'EXPECTED_CASE', 'WORST_CASE') NOT NULL DEFAULT 'ORIGINAL',
    `status` ENUM('DRAFT', 'IN_PREPARATION', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED', 'SUPERSEDED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `financialYearLabel` VARCHAR(16) NOT NULL,
    `fyStartDate` DATE NOT NULL,
    `fyEndDate` DATE NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `notes` VARCHAR(1000) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NULL,
    `submittedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `budget_version_tenant_code_key`(`tenantId`, `code`),
    INDEX `budget_versions_tenantId_idx`(`tenantId`),
    INDEX `budget_version_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `budget_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `costCentreId` VARCHAR(191) NULL,
    `amountApr` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountMay` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountJun` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountJul` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountAug` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountSep` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountOct` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountNov` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountDec` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountJan` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountFeb` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountMar` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `budget_line_version_account_key`(`versionId`, `accountId`),
    INDEX `budget_lines_tenantId_idx`(`tenantId`),
    INDEX `budget_line_version_idx`(`tenantId`, `versionId`),
    INDEX `budget_lines_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `budget_versions` ADD CONSTRAINT `budget_versions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `budget_versions` ADD CONSTRAINT `budget_versions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `budget_lines` ADD CONSTRAINT `budget_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `budget_lines` ADD CONSTRAINT `budget_lines_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `budget_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `budget_lines` ADD CONSTRAINT `budget_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
