-- Finance Phase 2A — Core ledger foundation (no posting engine)

CREATE TABLE `accounting_vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `accountingPeriodId` VARCHAR(191) NOT NULL,
    `voucherType` ENUM('JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'DEBIT_NOTE', 'CREDIT_NOTE', 'OPENING_BALANCE', 'REVERSAL', 'SYSTEM') NOT NULL,
    `voucherNumber` VARCHAR(64) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'SENT_BACK', 'REJECTED', 'REVERSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `documentDate` DATE NOT NULL,
    `postingDate` DATE NOT NULL,
    `referenceNumber` VARCHAR(100) NULL,
    `externalReference` VARCHAR(100) NULL,
    `narration` TEXT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `totalDebit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalCredit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTotalDebit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseTotalCredit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sourceModule` VARCHAR(64) NULL,
    `sourceDocumentType` VARCHAR(64) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentLineId` VARCHAR(191) NULL,
    `reversalOfVoucherId` VARCHAR(191) NULL,
    `reversedByVoucherId` VARCHAR(191) NULL,
    `reversalReason` VARCHAR(500) NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `currentApprovalLevel` INTEGER NOT NULL DEFAULT 0,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `acc_vch_tenant_le_fy_type_num_key`(`tenantId`, `legalEntityId`, `financialYearId`, `voucherType`, `voucherNumber`),
    INDEX `accounting_vouchers_tenantId_idx`(`tenantId`),
    INDEX `accounting_vouchers_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
    INDEX `accounting_vouchers_legalEntityId_postingDate_idx`(`legalEntityId`, `postingDate`),
    INDEX `accounting_vouchers_legalEntityId_voucherType_idx`(`legalEntityId`, `voucherType`),
    INDEX `accounting_vouchers_legalEntityId_status_idx`(`legalEntityId`, `status`),
    INDEX `accounting_vouchers_legalEntityId_voucherNumber_idx`(`legalEntityId`, `voucherNumber`),
    INDEX `accounting_vouchers_accountingPeriodId_status_idx`(`accountingPeriodId`, `status`),
    INDEX `acc_vch_src_doc_idx`(`sourceModule`, `sourceDocumentType`, `sourceDocumentId`),
    INDEX `accounting_vouchers_reversalOfVoucherId_idx`(`reversalOfVoucherId`),
    INDEX `accounting_vouchers_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `accounting_voucher_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `partyType` ENUM('CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER') NULL,
    `partyId` VARCHAR(191) NULL,
    `partyNameSnapshot` VARCHAR(300) NULL,
    `debitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseDebitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCreditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `costCentreId` VARCHAR(191) NULL,
    `projectReference` VARCHAR(64) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `referenceDocumentType` VARCHAR(64) NULL,
    `referenceDocumentId` VARCHAR(191) NULL,
    `referenceDocumentLineId` VARCHAR(191) NULL,
    `dueDate` DATE NULL,
    `lineNarration` VARCHAR(500) NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accounting_voucher_lines_voucherId_lineNumber_key`(`voucherId`, `lineNumber`),
    INDEX `accounting_voucher_lines_tenantId_idx`(`tenantId`),
    INDEX `accounting_voucher_lines_voucherId_idx`(`voucherId`),
    INDEX `accounting_voucher_lines_accountId_idx`(`accountId`),
    INDEX `accounting_voucher_lines_partyType_partyId_idx`(`partyType`, `partyId`),
    INDEX `accounting_voucher_lines_costCentreId_idx`(`costCentreId`),
    INDEX `acc_vch_line_ref_doc_idx`(`referenceDocumentType`, `referenceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `general_ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `accountingPeriodId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `voucherLineId` VARCHAR(191) NOT NULL,
    `voucherType` ENUM('JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'DEBIT_NOTE', 'CREDIT_NOTE', 'OPENING_BALANCE', 'REVERSAL', 'SYSTEM') NOT NULL,
    `voucherNumber` VARCHAR(64) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `postingDate` DATE NOT NULL,
    `documentDate` DATE NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `partyType` ENUM('CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER') NULL,
    `partyId` VARCHAR(191) NULL,
    `partyNameSnapshot` VARCHAR(300) NULL,
    `debitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseDebitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `baseCreditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `costCentreId` VARCHAR(191) NULL,
    `projectReference` VARCHAR(64) NULL,
    `departmentReference` VARCHAR(64) NULL,
    `sourceModule` VARCHAR(64) NULL,
    `sourceDocumentType` VARCHAR(64) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentLineId` VARCHAR(191) NULL,
    `isReversal` BOOLEAN NOT NULL DEFAULT false,
    `reversalOfEntryId` VARCHAR(191) NULL,
    `reversedByEntryId` VARCHAR(191) NULL,
    `postedBy` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `general_ledger_entries_voucherLineId_key`(`voucherLineId`),
    INDEX `general_ledger_entries_tenantId_legalEntityId_postingDate_idx`(`tenantId`, `legalEntityId`, `postingDate`),
    INDEX `general_ledger_entries_accountId_postingDate_idx`(`accountId`, `postingDate`),
    INDEX `general_ledger_entries_partyType_partyId_postingDate_idx`(`partyType`, `partyId`, `postingDate`),
    INDEX `general_ledger_entries_voucherId_idx`(`voucherId`),
    INDEX `general_ledger_entries_accountingPeriodId_idx`(`accountingPeriodId`),
    INDEX `gl_src_doc_idx`(`sourceModule`, `sourceDocumentType`, `sourceDocumentId`),
    INDEX `general_ledger_entries_costCentreId_postingDate_idx`(`costCentreId`, `postingDate`),
    INDEX `general_ledger_entries_reversalOfEntryId_idx`(`reversalOfEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `posting_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(200) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `eventVersion` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('RECEIVED', 'VALIDATING', 'VALIDATED', 'PROCESSING', 'POSTED', 'FAILED', 'REVERSED', 'IGNORED') NOT NULL DEFAULT 'RECEIVED',
    `sourceModule` VARCHAR(64) NULL,
    `sourceDocumentType` VARCHAR(64) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentLineId` VARCHAR(191) NULL,
    `payloadHash` VARCHAR(64) NOT NULL,
    `payloadJson` JSON NULL,
    `voucherId` VARCHAR(191) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastAttemptAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `errorCode` VARCHAR(64) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `posting_events_tenantId_legalEntityId_eventKey_key`(`tenantId`, `legalEntityId`, `eventKey`),
    INDEX `posting_events_status_idx`(`status`),
    INDEX `posting_events_eventType_idx`(`eventType`),
    INDEX `post_evt_src_doc_idx`(`sourceModule`, `sourceDocumentType`, `sourceDocumentId`),
    INDEX `posting_events_voucherId_idx`(`voucherId`),
    INDEX `posting_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `posting_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `ruleCode` VARCHAR(64) NOT NULL,
    `ruleName` VARCHAR(200) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `conditionsJson` JSON NULL,
    `lineDefinitionsJson` JSON NOT NULL,
    `isSystemRule` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `posting_rules_legalEntityId_ruleCode_version_key`(`legalEntityId`, `ruleCode`, `version`),
    INDEX `posting_rules_tenantId_idx`(`tenantId`),
    INDEX `posting_rules_legalEntityId_eventType_isActive_idx`(`legalEntityId`, `eventType`, `isActive`),
    INDEX `posting_rules_legalEntityId_priority_idx`(`legalEntityId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_accountingPeriodId_fkey` FOREIGN KEY (`accountingPeriodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_reversalOfVoucherId_fkey` FOREIGN KEY (`reversalOfVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_vouchers` ADD CONSTRAINT `accounting_vouchers_reversedByVoucherId_fkey` FOREIGN KEY (`reversedByVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `accounting_voucher_lines` ADD CONSTRAINT `accounting_voucher_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_voucher_lines` ADD CONSTRAINT `accounting_voucher_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_voucher_lines` ADD CONSTRAINT `accounting_voucher_lines_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_voucher_lines` ADD CONSTRAINT `accounting_voucher_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `accounting_voucher_lines` ADD CONSTRAINT `accounting_voucher_lines_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_accountingPeriodId_fkey` FOREIGN KEY (`accountingPeriodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_voucherLineId_fkey` FOREIGN KEY (`voucherLineId`) REFERENCES `accounting_voucher_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_costCentreId_fkey` FOREIGN KEY (`costCentreId`) REFERENCES `cost_centres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_reversalOfEntryId_fkey` FOREIGN KEY (`reversalOfEntryId`) REFERENCES `general_ledger_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `general_ledger_entries` ADD CONSTRAINT `general_ledger_entries_reversedByEntryId_fkey` FOREIGN KEY (`reversedByEntryId`) REFERENCES `general_ledger_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `posting_events` ADD CONSTRAINT `posting_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `posting_events` ADD CONSTRAINT `posting_events_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `posting_events` ADD CONSTRAINT `posting_events_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `posting_rules` ADD CONSTRAINT `posting_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `posting_rules` ADD CONSTRAINT `posting_rules_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
