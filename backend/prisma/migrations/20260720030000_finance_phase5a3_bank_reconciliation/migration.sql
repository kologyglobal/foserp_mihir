-- Phase 5A3 — Bank reconciliation sessions, matches, allocations, suggestions

-- AlterTable: reconciliation profile matching controls
ALTER TABLE `bank_reconciliation_profiles`
    ADD COLUMN `allowFinalizeWithExceptions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `allowManualGroupedMatch` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `allowManualPartialMatch` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `amountTolerance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `autoReconcileEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoReconcileScore` INTEGER NOT NULL DEFAULT 95,
    ADD COLUMN `dateToleranceDays` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `finalizationDifferenceTolerance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `groupedSuggestionsEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `maximumGroupSize` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `minimumSuggestionScore` INTEGER NOT NULL DEFAULT 65,
    ADD COLUMN `partialSuggestionsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `referenceNormalizationEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `requireFullMatchToFinalize` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `requireUniqueExactMatch` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: statement-line reconciliation read fields
ALTER TABLE `bank_statement_lines`
    ADD COLUMN `linkedJournalId` VARCHAR(191) NULL,
    ADD COLUMN `matchedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    MODIFY `matchStatus` ENUM('UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED', 'EXCEPTION', 'EXCLUDED', 'RECONCILED', 'REVERSED') NOT NULL DEFAULT 'UNMATCHED';

-- AlterTable: match reference number series
ALTER TABLE `finance_number_series`
    MODIFY `documentType` ENUM('JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL', 'SALES_INVOICE', 'CUSTOMER_RECEIPT', 'CUSTOMER_CREDIT_NOTE', 'VENDOR_INVOICE', 'VENDOR_PAYMENT', 'VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT', 'BANK_RECONCILIATION_MATCH') NOT NULL;

CREATE TABLE `bank_reconciliation_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `bankStatementId` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'READY_TO_FINALIZE', 'FINALIZED', 'REOPENED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `statementStartDate` DATE NOT NULL,
    `statementEndDate` DATE NOT NULL,
    `statementOpeningBalance` DECIMAL(18, 4) NULL,
    `statementClosingBalance` DECIMAL(18, 4) NULL,
    `totalStatementDebit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalStatementCredit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `matchedStatementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unmatchedStatementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `matchedBookAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unmatchedBookAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `adjustedStatementBalance` DECIMAL(18, 4) NULL,
    `adjustedBookBalance` DECIMAL(18, 4) NULL,
    `reconciliationDifference` DECIMAL(18, 4) NULL,
    `finalSummaryJson` JSON NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedById` VARCHAR(191) NULL,
    `reopenedAt` DATETIME(3) NULL,
    `reopenedById` VARCHAR(191) NULL,
    `reopenReason` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_reconciliation_sessions_bankStatementId_key`(`bankStatementId`),
    INDEX `bank_reconciliation_sessions_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_sessions_legalEntityId_idx`(`legalEntityId`),
    INDEX `bank_reconciliation_sessions_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `bank_recon_sess_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    UNIQUE INDEX `bank_recon_sess_tenant_stmt_key`(`tenantId`, `bankStatementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_matches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `reconciliationSessionId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `matchReference` VARCHAR(64) NOT NULL,
    `matchMethod` ENUM('AUTO_EXACT', 'AUTO_ACCEPTED', 'MANUAL', 'GROUPED_MANUAL', 'PARTIAL_MANUAL') NOT NULL,
    `matchSource` ENUM('DIRECT_BANK_GL', 'CLEARING_GL', 'JOURNAL_CREATED_FROM_STATEMENT') NOT NULL,
    `matchStatus` ENUM('ACTIVE', 'REVERSED') NOT NULL DEFAULT 'ACTIVE',
    `confidenceScore` DECIMAL(8, 2) NULL,
    `confidenceLevel` VARCHAR(16) NULL,
    `reasonCodes` JSON NULL,
    `accountCurrencyCode` VARCHAR(8) NOT NULL,
    `matchedAmount` DECIMAL(18, 4) NOT NULL,
    `baseMatchedAmount` DECIMAL(18, 4) NOT NULL,
    `postingMode` ENUM('NONE', 'CLEARING_SETTLEMENT') NOT NULL DEFAULT 'NONE',
    `accountingVoucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,
    `reversalPostingEventId` VARCHAR(191) NULL,
    `note` VARCHAR(1000) NULL,
    `idempotencyKey` VARCHAR(128) NOT NULL,
    `payloadHash` VARCHAR(64) NOT NULL,
    `matchedAt` DATETIME(3) NOT NULL,
    `matchedById` VARCHAR(191) NOT NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedById` VARCHAR(191) NULL,
    `reversalReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_reconciliation_matches_idempotencyKey_key`(`idempotencyKey`),
    INDEX `bank_reconciliation_matches_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_matches_legalEntityId_idx`(`legalEntityId`),
    INDEX `bank_reconciliation_matches_reconciliationSessionId_idx`(`reconciliationSessionId`),
    INDEX `bank_reconciliation_matches_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `bank_recon_match_status_idx`(`tenantId`, `matchStatus`),
    INDEX `bank_reconciliation_matches_matchReference_idx`(`matchReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_statement_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `reconciliationMatchId` VARCHAR(191) NOT NULL,
    `bankStatementLineId` VARCHAR(191) NOT NULL,
    `matchedAmount` DECIMAL(18, 4) NOT NULL,
    `baseMatchedAmount` DECIMAL(18, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_reconciliation_statement_allocations_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_statement_allocations_reconciliationMatc_idx`(`reconciliationMatchId`),
    INDEX `bank_reconciliation_statement_allocations_bankStatementLineI_idx`(`bankStatementLineId`),
    UNIQUE INDEX `bank_recon_stmt_alloc_match_line_key`(`reconciliationMatchId`, `bankStatementLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_ledger_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `reconciliationMatchId` VARCHAR(191) NOT NULL,
    `generalLedgerEntryId` VARCHAR(191) NOT NULL,
    `accountingVoucherId` VARCHAR(191) NULL,
    `sourceDocumentType` VARCHAR(64) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `sourceDocumentNumber` VARCHAR(64) NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `accountCurrencyCode` VARCHAR(8) NOT NULL,
    `matchedAmount` DECIMAL(18, 4) NOT NULL,
    `baseMatchedAmount` DECIMAL(18, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_reconciliation_ledger_allocations_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_ledger_allocations_reconciliationMatchId_idx`(`reconciliationMatchId`),
    INDEX `bank_reconciliation_ledger_allocations_generalLedgerEntryId_idx`(`generalLedgerEntryId`),
    UNIQUE INDEX `bank_recon_led_alloc_match_gl_key`(`reconciliationMatchId`, `generalLedgerEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_ledger_reconciliation_positions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `generalLedgerEntryId` VARCHAR(191) NOT NULL,
    `originalAmount` DECIMAL(18, 4) NOT NULL,
    `reconciledAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unreconciledAmount` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('UNRECONCILED', 'PARTIALLY_RECONCILED', 'FULLY_RECONCILED') NOT NULL DEFAULT 'UNRECONCILED',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_ledger_reconciliation_positions_generalLedgerEntryId_key`(`generalLedgerEntryId`),
    INDEX `bank_led_recon_pos_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_suggestions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `reconciliationSessionId` VARCHAR(191) NOT NULL,
    `suggestionReference` VARCHAR(64) NOT NULL,
    `suggestionType` ENUM('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY') NOT NULL,
    `confidenceScore` DECIMAL(8, 2) NOT NULL,
    `confidenceLevel` VARCHAR(16) NOT NULL,
    `reasonCodes` JSON NULL,
    `statementLineIds` JSON NOT NULL,
    `ledgerEntryIds` JSON NOT NULL,
    `suggestedAmount` VARCHAR(32) NOT NULL,
    `postingMode` ENUM('NONE', 'CLEARING_SETTLEMENT') NOT NULL,
    `payloadHash` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVALIDATED') NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_reconciliation_suggestions_tenantId_idx`(`tenantId`),
    INDEX `bank_recon_sugg_sess_status_idx`(`reconciliationSessionId`, `status`),
    UNIQUE INDEX `bank_recon_sugg_sess_ref_key`(`reconciliationSessionId`, `suggestionReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_match_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `reconciliationSessionId` VARCHAR(191) NOT NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `settingsSnapshot` JSON NULL,
    `linesScanned` INTEGER NOT NULL DEFAULT 0,
    `matchesCreated` INTEGER NOT NULL DEFAULT 0,
    `suggestionsCreated` INTEGER NOT NULL DEFAULT 0,
    `ambiguousLines` INTEGER NOT NULL DEFAULT 0,
    `noCandidateLines` INTEGER NOT NULL DEFAULT 0,
    `postingRequiredSuggestions` INTEGER NOT NULL DEFAULT 0,
    `durationMs` INTEGER NULL,
    `errorCode` VARCHAR(120) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `startedById` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `bank_reconciliation_match_runs_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_match_runs_reconciliationSessionId_idx`(`reconciliationSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_reconciliation_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `reconciliationSessionId` VARCHAR(191) NOT NULL,
    `bankStatementLineId` VARCHAR(191) NOT NULL,
    `reason` ENUM('UNKNOWN_TRANSACTION', 'REFERENCE_MISSING', 'AMOUNT_MISMATCH', 'DATE_MISMATCH', 'POSSIBLE_DUPLICATE', 'BANK_CHARGE_REQUIRES_JOURNAL', 'INTEREST_REQUIRES_JOURNAL', 'CURRENCY_MISMATCH', 'SOURCE_DOCUMENT_NOT_POSTED', 'OTHER') NOT NULL,
    `comment` VARCHAR(1000) NULL,
    `status` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `assignedToId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolutionReference` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_recon_exc_tenant_status_idx`(`tenantId`, `status`),
    INDEX `bank_reconciliation_exceptions_reconciliationSessionId_idx`(`reconciliationSessionId`),
    INDEX `bank_reconciliation_exceptions_bankStatementLineId_idx`(`bankStatementLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bank_reconciliation_sessions` ADD CONSTRAINT `bank_reconciliation_sessions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_sessions` ADD CONSTRAINT `bank_reconciliation_sessions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_sessions` ADD CONSTRAINT `bank_reconciliation_sessions_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_sessions` ADD CONSTRAINT `bank_reconciliation_sessions_bankStatementId_fkey` FOREIGN KEY (`bankStatementId`) REFERENCES `bank_statements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_reconciliationSessionId_fkey` FOREIGN KEY (`reconciliationSessionId`) REFERENCES `bank_reconciliation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_accountingVoucherId_fkey` FOREIGN KEY (`accountingVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_matches` ADD CONSTRAINT `bank_reconciliation_matches_reversalVoucherId_fkey` FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_statement_allocations` ADD CONSTRAINT `bank_reconciliation_statement_allocations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_statement_allocations` ADD CONSTRAINT `bank_reconciliation_statement_allocations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_statement_allocations` ADD CONSTRAINT `bank_reconciliation_statement_allocations_reconciliationMat_fkey` FOREIGN KEY (`reconciliationMatchId`) REFERENCES `bank_reconciliation_matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_statement_allocations` ADD CONSTRAINT `bank_reconciliation_statement_allocations_bankStatementLine_fkey` FOREIGN KEY (`bankStatementLineId`) REFERENCES `bank_statement_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_ledger_allocations` ADD CONSTRAINT `bank_reconciliation_ledger_allocations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_ledger_allocations` ADD CONSTRAINT `bank_reconciliation_ledger_allocations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_ledger_allocations` ADD CONSTRAINT `bank_reconciliation_ledger_allocations_reconciliationMatchI_fkey` FOREIGN KEY (`reconciliationMatchId`) REFERENCES `bank_reconciliation_matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_ledger_allocations` ADD CONSTRAINT `bank_reconciliation_ledger_allocations_generalLedgerEntryId_fkey` FOREIGN KEY (`generalLedgerEntryId`) REFERENCES `general_ledger_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `bank_ledger_reconciliation_positions` ADD CONSTRAINT `bank_ledger_reconciliation_positions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_ledger_reconciliation_positions` ADD CONSTRAINT `bank_ledger_reconciliation_positions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_ledger_reconciliation_positions` ADD CONSTRAINT `bank_ledger_reconciliation_positions_generalLedgerEntryId_fkey` FOREIGN KEY (`generalLedgerEntryId`) REFERENCES `general_ledger_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_suggestions` ADD CONSTRAINT `bank_reconciliation_suggestions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_suggestions` ADD CONSTRAINT `bank_reconciliation_suggestions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_suggestions` ADD CONSTRAINT `bank_reconciliation_suggestions_reconciliationSessionId_fkey` FOREIGN KEY (`reconciliationSessionId`) REFERENCES `bank_reconciliation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_match_runs` ADD CONSTRAINT `bank_reconciliation_match_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_match_runs` ADD CONSTRAINT `bank_reconciliation_match_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_match_runs` ADD CONSTRAINT `bank_reconciliation_match_runs_reconciliationSessionId_fkey` FOREIGN KEY (`reconciliationSessionId`) REFERENCES `bank_reconciliation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `bank_reconciliation_exceptions` ADD CONSTRAINT `bank_reconciliation_exceptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_exceptions` ADD CONSTRAINT `bank_reconciliation_exceptions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_exceptions` ADD CONSTRAINT `bank_reconciliation_exceptions_reconciliationSessionId_fkey` FOREIGN KEY (`reconciliationSessionId`) REFERENCES `bank_reconciliation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_exceptions` ADD CONSTRAINT `bank_reconciliation_exceptions_bankStatementLineId_fkey` FOREIGN KEY (`bankStatementLineId`) REFERENCES `bank_statement_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
