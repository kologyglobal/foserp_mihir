-- Finance Phase 5A1 -- Bank & Cash treasury foundation
-- Additive only. No statement import/match/reconcile execution APIs, no GL/voucher/PostingEvent
-- mutation from any endpoint added alongside this migration.

-- CreateTable treasury_accounts
CREATE TABLE `treasury_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `accountType` ENUM('BANK', 'CASH', 'CLEARING') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `glAccountId` VARCHAR(191) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `description` VARCHAR(500) NULL,
    `activatedAt` DATETIME(3) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `deactivatedBy` VARCHAR(191) NULL,
    `deactivationReason` VARCHAR(500) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` VARCHAR(191) NULL,
    `closeReason` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treas_acct_tenant_le_code_key`(`tenantId`, `legalEntityId`, `code`),
    INDEX `treasury_accounts_tenantId_idx`(`tenantId`),
    INDEX `treasury_accounts_legalEntityId_idx`(`legalEntityId`),
    INDEX `treas_acct_le_type_idx`(`tenantId`, `legalEntityId`, `accountType`),
    INDEX `treas_acct_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `treasury_accounts_glAccountId_idx`(`glAccountId`),
    INDEX `treasury_accounts_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable treasury_bank_profiles
CREATE TABLE `treasury_bank_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(200) NOT NULL,
    `branchName` VARCHAR(200) NULL,
    `ifscCode` VARCHAR(11) NULL,
    `swiftCode` VARCHAR(11) NULL,
    `micrCode` VARCHAR(20) NULL,
    `bankAccountKind` ENUM('CURRENT', 'SAVINGS', 'OVERDRAFT', 'CASH_CREDIT', 'ESCROW', 'VIRTUAL', 'NOSTRO', 'OTHER') NOT NULL DEFAULT 'CURRENT',
    `accountNumberLast4` VARCHAR(4) NULL,
    `accountNumberMasked` VARCHAR(40) NULL,
    `accountNumberHash` VARCHAR(128) NULL,
    `accountNumberEncrypted` TEXT NULL,
    `accountHolderName` VARCHAR(200) NULL,
    `overdraftLimit` DECIMAL(18, 4) NULL,
    `upiVpa` VARCHAR(100) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treasury_bank_profiles_treasuryAccountId_key`(`treasuryAccountId`),
    UNIQUE INDEX `treas_bank_prof_hash_key`(`tenantId`, `legalEntityId`, `accountNumberHash`),
    INDEX `treasury_bank_profiles_tenantId_idx`(`tenantId`),
    INDEX `treasury_bank_profiles_legalEntityId_idx`(`legalEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable treasury_cash_profiles
CREATE TABLE `treasury_cash_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `custodianName` VARCHAR(200) NULL,
    `custodianUserId` VARCHAR(191) NULL,
    `locationDescription` VARCHAR(300) NULL,
    `imprestLimit` DECIMAL(18, 4) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treasury_cash_profiles_treasuryAccountId_key`(`treasuryAccountId`),
    INDEX `treasury_cash_profiles_tenantId_idx`(`tenantId`),
    INDEX `treasury_cash_profiles_legalEntityId_idx`(`legalEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payment_account_mappings
CREATE TABLE `payment_account_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `paymentMethod` ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'PAYMENT_GATEWAY', 'DIRECT_DEBIT', 'OTHER') NOT NULL,
    `direction` ENUM('RECEIPT', 'PAYMENT', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `useCase` ENUM('CUSTOMER_RECEIPT', 'CUSTOMER_REFUND', 'VENDOR_PAYMENT', 'VENDOR_ADVANCE', 'VENDOR_REFUND', 'BANK_TRANSFER_IN', 'BANK_TRANSFER_OUT', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'BANK_CHARGE', 'BANK_INTEREST', 'CARD_SETTLEMENT', 'UPI_SETTLEMENT', 'CHEQUE_RECEIPT', 'CHEQUE_PAYMENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `role` ENUM('DIRECT_POSTING', 'CLEARING', 'SETTLEMENT', 'CHARGE') NOT NULL DEFAULT 'DIRECT_POSTING',
    `currencyCode` VARCHAR(8) NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `clearingAccountId` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_account_mappings_tenantId_idx`(`tenantId`),
    INDEX `payment_account_mappings_legalEntityId_idx`(`legalEntityId`),
    INDEX `pay_acct_map_le_method_use_idx`(`tenantId`, `legalEntityId`, `paymentMethod`, `useCase`),
    INDEX `pay_acct_map_le_active_idx`(`tenantId`, `legalEntityId`, `isActive`),
    INDEX `payment_account_mappings_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `payment_account_mappings_clearingAccountId_idx`(`clearingAccountId`),
    INDEX `payment_account_mappings_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable bank_reconciliation_profiles
CREATE TABLE `bank_reconciliation_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `dateBasis` ENUM('TRANSACTION_DATE', 'VALUE_DATE') NOT NULL DEFAULT 'TRANSACTION_DATE',
    `autoMatchEnabled` BOOLEAN NOT NULL DEFAULT false,
    `autoMatchToleranceAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `autoMatchToleranceDays` INTEGER NOT NULL DEFAULT 0,
    `requireApprovalForMatch` BOOLEAN NOT NULL DEFAULT true,
    `duplicatePolicy` ENUM('BLOCK', 'WARN', 'ALLOW_WITH_REVIEW') NOT NULL DEFAULT 'BLOCK',
    `lastReconciledDate` DATE NULL,
    `lastReconciledBalance` DECIMAL(18, 4) NULL,
    `lastReconciledAt` DATETIME(3) NULL,
    `lastReconciledBy` VARCHAR(191) NULL,
    `notes` VARCHAR(1000) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_reconciliation_profiles_treasuryAccountId_key`(`treasuryAccountId`),
    INDEX `bank_reconciliation_profiles_tenantId_idx`(`tenantId`),
    INDEX `bank_reconciliation_profiles_legalEntityId_idx`(`legalEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable bank_statement_import_batches
CREATE TABLE `bank_statement_import_batches` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `batchReference` VARCHAR(64) NOT NULL,
    `sourceType` ENUM('FILE_UPLOAD', 'MANUAL', 'BANK_API', 'SYSTEM_GENERATED', 'OTHER') NOT NULL DEFAULT 'FILE_UPLOAD',
    `importFormat` ENUM('CSV', 'XLSX', 'MT940', 'CAMT_053', 'MANUAL', 'AUTO_DETECT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `duplicatePolicy` ENUM('BLOCK', 'WARN', 'ALLOW_WITH_REVIEW') NOT NULL DEFAULT 'BLOCK',
    `status` ENUM('UPLOADED', 'PROCESSING', 'IMPORTED', 'PARTIALLY_IMPORTED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'UPLOADED',
    `fileName` VARCHAR(300) NULL,
    `fileSizeBytes` INTEGER NULL,
    `fileChecksum` VARCHAR(128) NULL,
    `totalLineCount` INTEGER NOT NULL DEFAULT 0,
    `importedLineCount` INTEGER NOT NULL DEFAULT 0,
    `failedLineCount` INTEGER NOT NULL DEFAULT 0,
    `duplicateLineCount` INTEGER NOT NULL DEFAULT 0,
    `errorSummary` JSON NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_stmt_batch_ref_key`(`tenantId`, `legalEntityId`, `batchReference`),
    INDEX `bank_statement_import_batches_tenantId_idx`(`tenantId`),
    INDEX `bank_statement_import_batches_legalEntityId_idx`(`legalEntityId`),
    INDEX `bank_statement_import_batches_treasuryAccountId_idx`(`treasuryAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable bank_statements
CREATE TABLE `bank_statements` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `importBatchId` VARCHAR(191) NULL,
    `statementReference` VARCHAR(64) NOT NULL,
    `statementDate` DATE NOT NULL,
    `periodStartDate` DATE NOT NULL,
    `periodEndDate` DATE NOT NULL,
    `dateBasis` ENUM('TRANSACTION_DATE', 'VALUE_DATE') NOT NULL DEFAULT 'TRANSACTION_DATE',
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `openingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `closingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalCreditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalDebitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lineCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'IMPORTED', 'VALIDATION_FAILED', 'VALIDATED', 'READY_TO_RECONCILE', 'PARTIALLY_RECONCILED', 'RECONCILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `sourceType` ENUM('FILE_UPLOAD', 'MANUAL', 'BANK_API', 'SYSTEM_GENERATED', 'OTHER') NOT NULL DEFAULT 'FILE_UPLOAD',
    `statementUniquenessKey` VARCHAR(300) NULL,
    `validationErrors` JSON NULL,
    `validatedAt` DATETIME(3) NULL,
    `validatedBy` VARCHAR(191) NULL,
    `reconciledAt` DATETIME(3) NULL,
    `reconciledBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_statements_statementUniquenessKey_key`(`statementUniquenessKey`),
    INDEX `bank_statements_tenantId_idx`(`tenantId`),
    INDEX `bank_statements_legalEntityId_idx`(`legalEntityId`),
    INDEX `bank_statements_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `bank_statements_importBatchId_idx`(`importBatchId`),
    INDEX `bank_stmt_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable bank_statement_lines
CREATE TABLE `bank_statement_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `bankStatementId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `transactionDate` DATE NOT NULL,
    `valueDate` DATE NULL,
    `direction` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `description` VARCHAR(500) NULL,
    `referenceNumber` VARCHAR(128) NULL,
    `counterpartyName` VARCHAR(200) NULL,
    `bankTransactionId` VARCHAR(128) NULL,
    `runningBalance` DECIMAL(18, 4) NULL,
    `matchStatus` ENUM('UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED', 'EXCLUDED', 'RECONCILED', 'REVERSED') NOT NULL DEFAULT 'UNMATCHED',
    `lineHash` VARCHAR(128) NOT NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_stmt_line_num_key`(`bankStatementId`, `lineNumber`),
    UNIQUE INDEX `bank_stmt_line_hash_key`(`bankStatementId`, `lineHash`),
    INDEX `bank_statement_lines_tenantId_idx`(`tenantId`),
    INDEX `bank_statement_lines_legalEntityId_idx`(`legalEntityId`),
    INDEX `bank_statement_lines_bankStatementId_idx`(`bankStatementId`),
    INDEX `bank_stmt_line_match_idx`(`bankStatementId`, `matchStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable customer_receipts / vendor_payments: soft treasuryAccountId reference (no FK)
ALTER TABLE `customer_receipts` ADD COLUMN `treasuryAccountId` VARCHAR(191) NULL;
CREATE INDEX `customer_receipts_treasuryAccountId_idx` ON `customer_receipts`(`treasuryAccountId`);

ALTER TABLE `vendor_payments` ADD COLUMN `treasuryAccountId` VARCHAR(191) NULL;
CREATE INDEX `vendor_payments_treasuryAccountId_idx` ON `vendor_payments`(`treasuryAccountId`);

-- Foreign keys: TreasuryAccount
ALTER TABLE `treasury_accounts` ADD CONSTRAINT `treasury_accounts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_accounts` ADD CONSTRAINT `treasury_accounts_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_accounts` ADD CONSTRAINT `treasury_accounts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `treasury_accounts` ADD CONSTRAINT `treasury_accounts_glAccountId_fkey` FOREIGN KEY (`glAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: TreasuryBankProfile
ALTER TABLE `treasury_bank_profiles` ADD CONSTRAINT `treasury_bank_profiles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_bank_profiles` ADD CONSTRAINT `treasury_bank_profiles_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_bank_profiles` ADD CONSTRAINT `treasury_bank_profiles_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: TreasuryCashProfile
ALTER TABLE `treasury_cash_profiles` ADD CONSTRAINT `treasury_cash_profiles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_cash_profiles` ADD CONSTRAINT `treasury_cash_profiles_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_cash_profiles` ADD CONSTRAINT `treasury_cash_profiles_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: PaymentAccountMapping
ALTER TABLE `payment_account_mappings` ADD CONSTRAINT `payment_account_mappings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_account_mappings` ADD CONSTRAINT `payment_account_mappings_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_account_mappings` ADD CONSTRAINT `payment_account_mappings_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payment_account_mappings` ADD CONSTRAINT `payment_account_mappings_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_account_mappings` ADD CONSTRAINT `payment_account_mappings_clearingAccountId_fkey` FOREIGN KEY (`clearingAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: BankReconciliationProfile
ALTER TABLE `bank_reconciliation_profiles` ADD CONSTRAINT `bank_reconciliation_profiles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_profiles` ADD CONSTRAINT `bank_reconciliation_profiles_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_reconciliation_profiles` ADD CONSTRAINT `bank_reconciliation_profiles_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: BankStatementImportBatch
ALTER TABLE `bank_statement_import_batches` ADD CONSTRAINT `bank_statement_import_batches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statement_import_batches` ADD CONSTRAINT `bank_statement_import_batches_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statement_import_batches` ADD CONSTRAINT `bank_statement_import_batches_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: BankStatement
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `bank_statement_import_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: BankStatementLine
ALTER TABLE `bank_statement_lines` ADD CONSTRAINT `bank_statement_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statement_lines` ADD CONSTRAINT `bank_statement_lines_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_statement_lines` ADD CONSTRAINT `bank_statement_lines_bankStatementId_fkey` FOREIGN KEY (`bankStatementId`) REFERENCES `bank_statements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
