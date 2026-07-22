-- Phase 5A2 — Bank statement CSV/XLSX import, mapping templates, import issues

CREATE TABLE `bank_statement_column_mapping_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NULL,
    `bankNameKey` VARCHAR(200) NULL,
    `name` VARCHAR(120) NOT NULL,
    `importFormat` ENUM('CSV', 'XLSX', 'MT940', 'CAMT_053', 'MANUAL', 'AUTO_DETECT', 'OTHER') NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sheetNamePattern` VARCHAR(120) NULL,
    `headerRowNumber` INTEGER NULL,
    `dataStartRowNumber` INTEGER NULL,
    `delimiter` VARCHAR(8) NULL,
    `encoding` VARCHAR(32) NULL,
    `mappingConfig` JSON NOT NULL,
    `parsingConfig` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_stmt_map_tmpl_name_key`(`tenantId`, `legalEntityId`, `name`),
    INDEX `bank_stmt_map_tmpl_acct_idx`(`tenantId`, `legalEntityId`, `treasuryAccountId`, `isActive`),
    INDEX `bank_stmt_map_tmpl_bank_idx`(`tenantId`, `legalEntityId`, `bankNameKey`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bank_statement_import_batches`
    ADD COLUMN `originalFileName` VARCHAR(300) NULL,
    ADD COLUMN `sanitisedFileName` VARCHAR(300) NULL,
    ADD COLUMN `storageKey` VARCHAR(500) NULL,
    ADD COLUMN `mimeType` VARCHAR(120) NULL,
    ADD COLUMN `mappingTemplateId` VARCHAR(191) NULL,
    ADD COLUMN `inspectConfig` JSON NULL,
    ADD COLUMN `mappingConfig` JSON NULL,
    ADD COLUMN `parsingConfig` JSON NULL,
    ADD COLUMN `warningCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `errorCount` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `bank_stmt_batch_checksum_idx` ON `bank_statement_import_batches`(`tenantId`, `legalEntityId`, `treasuryAccountId`, `fileChecksum`);
CREATE INDEX `bank_statement_import_batches_mappingTemplateId_idx` ON `bank_statement_import_batches`(`mappingTemplateId`);

ALTER TABLE `bank_statements`
    ADD COLUMN `externalStatementId` VARCHAR(128) NULL,
    ADD COLUMN `balanceDifference` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `importFormat` ENUM('CSV', 'XLSX', 'MT940', 'CAMT_053', 'MANUAL', 'AUTO_DETECT', 'OTHER') NULL,
    ADD COLUMN `reopenReason` VARCHAR(500) NULL,
    ADD COLUMN `reopenedAt` DATETIME(3) NULL,
    ADD COLUMN `reopenedBy` VARCHAR(191) NULL;

ALTER TABLE `bank_statement_lines`
    ADD COLUMN `sourceRowNumber` INTEGER NULL,
    ADD COLUMN `normalizedDescription` VARCHAR(500) NULL,
    ADD COLUMN `utrReference` VARCHAR(128) NULL,
    ADD COLUMN `chequeNumber` VARCHAR(64) NULL,
    ADD COLUMN `transactionCode` VARCHAR(64) NULL,
    ADD COLUMN `counterpartyAccountMasked` VARCHAR(40) NULL,
    ADD COLUMN `counterpartyBankCode` VARCHAR(32) NULL,
    ADD COLUMN `externalLineId` VARCHAR(128) NULL,
    ADD COLUMN `externalTransactionId` VARCHAR(128) NULL,
    ADD COLUMN `isExcluded` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `bank_stmt_line_content_hash_idx` ON `bank_statement_lines`(`tenantId`, `legalEntityId`, `lineHash`);

CREATE TABLE `bank_statement_import_issues` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `importBatchId` VARCHAR(191) NULL,
    `bankStatementId` VARCHAR(191) NULL,
    `bankStatementLineId` VARCHAR(191) NULL,
    `rowNumber` INTEGER NULL,
    `columnName` VARCHAR(120) NULL,
    `severity` ENUM('INFO', 'WARNING', 'ERROR', 'BLOCKER') NOT NULL,
    `category` ENUM('FILE', 'SHEET', 'HEADER', 'COLUMN_MAPPING', 'DATE', 'AMOUNT', 'DIRECTION', 'REFERENCE', 'CURRENCY', 'BALANCE', 'DUPLICATE_FILE', 'DUPLICATE_STATEMENT', 'DUPLICATE_LINE', 'SECURITY', 'ROW', 'STATEMENT') NOT NULL,
    `code` VARCHAR(120) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `rawValue` TEXT NULL,
    `normalizedValue` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_stmt_issue_batch_sev_idx`(`tenantId`, `legalEntityId`, `importBatchId`, `severity`),
    INDEX `bank_stmt_issue_stmt_idx`(`tenantId`, `legalEntityId`, `bankStatementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bank_statement_column_mapping_templates`
    ADD CONSTRAINT `bank_statement_column_mapping_templates_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_column_mapping_templates_legalEntityId_fkey`
        FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_column_mapping_templates_treasuryAccountId_fkey`
        FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `bank_statement_import_batches`
    ADD CONSTRAINT `bank_statement_import_batches_mappingTemplateId_fkey`
        FOREIGN KEY (`mappingTemplateId`) REFERENCES `bank_statement_column_mapping_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `bank_statement_import_issues`
    ADD CONSTRAINT `bank_statement_import_issues_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_import_issues_legalEntityId_fkey`
        FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_import_issues_importBatchId_fkey`
        FOREIGN KEY (`importBatchId`) REFERENCES `bank_statement_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_import_issues_bankStatementId_fkey`
        FOREIGN KEY (`bankStatementId`) REFERENCES `bank_statements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `bank_statement_import_issues_bankStatementLineId_fkey`
        FOREIGN KEY (`bankStatementLineId`) REFERENCES `bank_statement_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
