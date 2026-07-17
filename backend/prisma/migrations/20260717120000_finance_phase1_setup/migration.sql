-- Finance Phase 1 — Legal entity / setup (no GL posting)

CREATE TABLE `legal_entities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `legalName` VARCHAR(300) NOT NULL,
    `displayName` VARCHAR(300) NOT NULL,
    `entityType` ENUM('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP', 'PROPRIETORSHIP', 'TRUST', 'OTHER') NOT NULL DEFAULT 'PRIVATE_LIMITED',
    `pan` VARCHAR(10) NULL,
    `cin` VARCHAR(21) NULL,
    `gstin` VARCHAR(15) NULL,
    `baseCurrency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `countryCode` VARCHAR(2) NOT NULL DEFAULT 'IN',
    `stateCode` VARCHAR(8) NULL,
    `registeredAddressJson` JSON NULL,
    `billingAddressJson` JSON NULL,
    `fiscalYearStartMonth` INTEGER NOT NULL DEFAULT 4,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `legal_entities_tenantId_code_key`(`tenantId`, `code`),
    INDEX `legal_entities_tenantId_idx`(`tenantId`),
    INDEX `legal_entities_tenantId_isDefault_idx`(`tenantId`, `isDefault`),
    INDEX `legal_entities_tenantId_isActive_idx`(`tenantId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `branchType` ENUM('HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'SALES_OFFICE', 'SERVICE_CENTRE', 'OTHER') NOT NULL DEFAULT 'HEAD_OFFICE',
    `gstin` VARCHAR(15) NULL,
    `stateCode` VARCHAR(8) NULL,
    `addressJson` JSON NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(255) NULL,
    `isHeadOffice` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_legalEntityId_code_key`(`legalEntityId`, `code`),
    INDEX `branches_tenantId_idx`(`tenantId`),
    INDEX `branches_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `branches_legalEntityId_isHeadOffice_idx`(`legalEntityId`, `isHeadOffice`),
    INDEX `branches_legalEntityId_isDefault_idx`(`legalEntityId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `financial_years` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `isCurrent` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `financial_years_tenantId_idx`(`tenantId`),
    INDEX `financial_years_legalEntityId_idx`(`legalEntityId`),
    INDEX `financial_years_legalEntityId_startDate_endDate_idx`(`legalEntityId`, `startDate`, `endDate`),
    INDEX `financial_years_legalEntityId_isCurrent_idx`(`legalEntityId`, `isCurrent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `accounting_periods` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `periodNumber` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'CLOSED', 'REOPENED') NOT NULL DEFAULT 'OPEN',
    `closedAt` DATETIME(3) NULL,
    `closedBy` VARCHAR(191) NULL,
    `reopenedAt` DATETIME(3) NULL,
    `reopenedBy` VARCHAR(191) NULL,
    `reopenReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accounting_periods_financialYearId_periodNumber_key`(`financialYearId`, `periodNumber`),
    INDEX `accounting_periods_tenantId_idx`(`tenantId`),
    INDEX `accounting_periods_legalEntityId_idx`(`legalEntityId`),
    INDEX `accounting_periods_financialYearId_idx`(`financialYearId`),
    INDEX `accounting_periods_legalEntityId_startDate_endDate_idx`(`legalEntityId`, `startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `accountCode` VARCHAR(32) NOT NULL,
    `accountName` VARCHAR(200) NOT NULL,
    `parentAccountId` VARCHAR(191) NULL,
    `category` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `accountType` ENUM('GENERAL', 'BANK', 'CASH', 'CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE', 'RAW_MATERIAL_INVENTORY', 'WIP_INVENTORY', 'FINISHED_GOODS_INVENTORY', 'FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'GST_INPUT', 'GST_OUTPUT', 'TDS_RECEIVABLE', 'TDS_PAYABLE', 'SALES', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN', 'EXPENSE', 'OTHER_INCOME', 'PRODUCTION_VARIANCE', 'RETAINED_EARNINGS') NOT NULL DEFAULT 'GENERAL',
    `level` INTEGER NOT NULL DEFAULT 1,
    `isGroup` BOOLEAN NOT NULL DEFAULT false,
    `isControlAccount` BOOLEAN NOT NULL DEFAULT false,
    `allowManualPosting` BOOLEAN NOT NULL DEFAULT true,
    `normalBalance` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT',
    `currencyCode` VARCHAR(8) NULL,
    `requiresParty` BOOLEAN NOT NULL DEFAULT false,
    `requiresReconciliation` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accounts_legalEntityId_accountCode_key`(`legalEntityId`, `accountCode`),
    INDEX `accounts_tenantId_idx`(`tenantId`),
    INDEX `accounts_legalEntityId_idx`(`legalEntityId`),
    INDEX `accounts_legalEntityId_category_idx`(`legalEntityId`, `category`),
    INDEX `accounts_parentAccountId_idx`(`parentAccountId`),
    INDEX `accounts_legalEntityId_isActive_idx`(`legalEntityId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `default_account_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `mappingKey` ENUM('CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE', 'SALES_REVENUE', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN', 'RAW_MATERIAL_INVENTORY', 'WIP_INVENTORY', 'FINISHED_GOODS_INVENTORY', 'STOCK_ADJUSTMENT', 'MATERIAL_CONSUMPTION', 'PRODUCTION_VARIANCE', 'SCRAP_INVENTORY', 'SCRAP_LOSS', 'SUBCONTRACTING_EXPENSE', 'FREIGHT_INWARD', 'FREIGHT_OUTWARD', 'GST_INPUT_CGST', 'GST_INPUT_SGST', 'GST_INPUT_IGST', 'GST_OUTPUT_CGST', 'GST_OUTPUT_SGST', 'GST_OUTPUT_IGST', 'TDS_RECEIVABLE', 'TDS_PAYABLE', 'BANK_CHARGES', 'ROUNDING', 'DEPRECIATION_EXPENSE', 'ACCUMULATED_DEPRECIATION', 'ASSET_DISPOSAL_GAIN', 'ASSET_DISPOSAL_LOSS', 'RETAINED_EARNINGS') NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `default_account_mappings_legalEntityId_mappingKey_key`(`legalEntityId`, `mappingKey`),
    INDEX `default_account_mappings_tenantId_idx`(`tenantId`),
    INDEX `default_account_mappings_legalEntityId_idx`(`legalEntityId`),
    INDEX `default_account_mappings_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `finance_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `baseCurrency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `dateFormat` VARCHAR(32) NOT NULL DEFAULT 'DD/MM/YYYY',
    `amountPrecision` INTEGER NOT NULL DEFAULT 2,
    `quantityPrecision` INTEGER NOT NULL DEFAULT 3,
    `roundingMethod` ENUM('ROUND_HALF_UP', 'ROUND_HALF_EVEN', 'ROUND_DOWN', 'ROUND_UP') NOT NULL DEFAULT 'ROUND_HALF_UP',
    `roundingTolerance` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `allowBackdatedPosting` BOOLEAN NOT NULL DEFAULT false,
    `backdatedDaysLimit` INTEGER NOT NULL DEFAULT 0,
    `requireAttachmentAbove` DECIMAL(18, 4) NULL,
    `receiptApprovalLimit` DECIMAL(18, 4) NULL,
    `paymentApprovalLimit` DECIMAL(18, 4) NULL,
    `journalApprovalLimit` DECIMAL(18, 4) NULL,
    `writeOffTolerance` DECIMAL(18, 4) NULL,
    `bankChargeTolerance` DECIMAL(18, 4) NULL,
    `allowManualControlAccountPosting` BOOLEAN NOT NULL DEFAULT false,
    `financeActivated` BOOLEAN NOT NULL DEFAULT false,
    `activatedAt` DATETIME(3) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `finance_settings_legalEntityId_key`(`legalEntityId`),
    INDEX `finance_settings_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cost_centres` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `isGroup` BOOLEAN NOT NULL DEFAULT false,
    `managerUserId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cost_centres_legalEntityId_code_key`(`legalEntityId`, `code`),
    INDEX `cost_centres_tenantId_idx`(`tenantId`),
    INDEX `cost_centres_legalEntityId_idx`(`legalEntityId`),
    INDEX `cost_centres_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `finance_feature_controls` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `featureKey` ENUM('RECEIVABLES', 'PAYABLES', 'BANK_RECONCILIATION', 'GST', 'TDS', 'FIXED_ASSETS', 'MANUFACTURING_ACCOUNTING', 'BUDGETING', 'MULTI_CURRENCY', 'COST_CENTRES', 'PROJECT_ACCOUNTING', 'APPROVALS') NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `configurationJson` JSON NULL,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `finance_feature_controls_legalEntityId_featureKey_key`(`legalEntityId`, `featureKey`),
    INDEX `finance_feature_controls_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `finance_approval_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(64) NOT NULL,
    `ruleName` VARCHAR(200) NOT NULL,
    `amountFrom` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `amountTo` DECIMAL(18, 4) NULL,
    `conditionJson` JSON NULL,
    `approverRoleId` VARCHAR(191) NULL,
    `approverUserId` VARCHAR(191) NULL,
    `approvalLevel` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `finance_approval_rules_tenantId_idx`(`tenantId`),
    INDEX `finance_approval_rules_legalEntityId_idx`(`legalEntityId`),
    INDEX `finance_approval_rules_legalEntityId_documentType_idx`(`legalEntityId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `finance_number_series` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL') NOT NULL,
    `financialYearId` VARCHAR(191) NULL,
    `prefix` VARCHAR(20) NOT NULL,
    `currentValue` INTEGER NOT NULL DEFAULT 0,
    `padLength` INTEGER NOT NULL DEFAULT 6,
    `resetEachYear` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `finance_number_series_legalEntityId_documentType_key`(`legalEntityId`, `documentType`),
    INDEX `finance_number_series_tenantId_idx`(`tenantId`),
    INDEX `finance_number_series_legalEntityId_idx`(`legalEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `legal_entities` ADD CONSTRAINT `legal_entities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `branches` ADD CONSTRAINT `branches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `branches` ADD CONSTRAINT `branches_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `financial_years` ADD CONSTRAINT `financial_years_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `financial_years` ADD CONSTRAINT `financial_years_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `accounts` ADD CONSTRAINT `accounts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_parentAccountId_fkey` FOREIGN KEY (`parentAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `default_account_mappings` ADD CONSTRAINT `default_account_mappings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `default_account_mappings` ADD CONSTRAINT `default_account_mappings_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `default_account_mappings` ADD CONSTRAINT `default_account_mappings_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finance_settings` ADD CONSTRAINT `finance_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_settings` ADD CONSTRAINT `finance_settings_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `cost_centres` ADD CONSTRAINT `cost_centres_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cost_centres` ADD CONSTRAINT `cost_centres_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cost_centres` ADD CONSTRAINT `cost_centres_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `cost_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `finance_feature_controls` ADD CONSTRAINT `finance_feature_controls_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_feature_controls` ADD CONSTRAINT `finance_feature_controls_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finance_approval_rules` ADD CONSTRAINT `finance_approval_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_approval_rules` ADD CONSTRAINT `finance_approval_rules_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finance_number_series` ADD CONSTRAINT `finance_number_series_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_number_series` ADD CONSTRAINT `finance_number_series_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_number_series` ADD CONSTRAINT `finance_number_series_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
