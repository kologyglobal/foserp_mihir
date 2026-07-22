-- Finance Phase 4D2 — AP-to-GL reconciliation + close gate
-- Additive only. No mutation of general_ledger_entries, payable_open_items,
-- accounting_periods, or any voucher/posting-event table. This migration only
-- adds new reconciliation/close-gate tables plus two FinanceSettings columns.

-- AlterTable finance_settings
ALTER TABLE `finance_settings`
  ADD COLUMN `apReconciliationTolerance` DECIMAL(18, 4) NULL,
  ADD COLUMN `apPostingEventStuckMinutes` INTEGER NOT NULL DEFAULT 30;

-- CreateTable payable_reconciliation_runs
CREATE TABLE `payable_reconciliation_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `asOfDate` DATE NOT NULL,
    `sourceMode` ENUM('CURRENT_BALANCE', 'HISTORICAL_RECONSTRUCTION') NOT NULL,
    `runStatus` ENUM('STARTED', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'STARTED',
    `status` ENUM('MATCHED', 'MATCHED_WITH_WARNINGS', 'MISMATCHED', 'FAILED') NULL,
    `baseCurrency` VARCHAR(8) NOT NULL,
    `tolerance` DECIMAL(18, 4) NOT NULL,
    `includeVendorLevel` BOOLEAN NOT NULL DEFAULT true,
    `controlAccountCount` INTEGER NOT NULL DEFAULT 0,
    `matchedAccountCount` INTEGER NOT NULL DEFAULT 0,
    `mismatchedAccountCount` INTEGER NOT NULL DEFAULT 0,
    `glTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `subledgerTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `variance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `exceptionCount` INTEGER NOT NULL DEFAULT 0,
    `infoCount` INTEGER NOT NULL DEFAULT 0,
    `warningCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `blockerCount` INTEGER NOT NULL DEFAULT 0,
    `vendorCount` INTEGER NOT NULL DEFAULT 0,
    `vendorMismatchCount` INTEGER NOT NULL DEFAULT 0,
    `limitations` JSON NULL,
    `errorMessage` VARCHAR(1000) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payable_reconciliation_runs_tenantId_idx`(`tenantId`),
    INDEX `payable_reconciliation_runs_legalEntityId_idx`(`legalEntityId`),
    INDEX `pay_recon_run_le_date_idx`(`tenantId`, `legalEntityId`, `asOfDate`),
    INDEX `pay_recon_run_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `payable_reconciliation_runs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_reconciliation_account_results
CREATE TABLE `payable_reconciliation_account_results` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `accountCode` VARCHAR(32) NULL,
    `accountName` VARCHAR(200) NULL,
    `glBalance` DECIMAL(18, 4) NOT NULL,
    `subledgerBalance` DECIMAL(18, 4) NOT NULL,
    `variance` DECIMAL(18, 4) NOT NULL,
    `matched` BOOLEAN NOT NULL DEFAULT false,
    `openItemCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pay_recon_acct_run_account_key`(`runId`, `accountId`),
    INDEX `pay_recon_acct_le_idx`(`tenantId`, `legalEntityId`),
    INDEX `payable_reconciliation_account_results_runId_idx`(`runId`),
    INDEX `payable_reconciliation_account_results_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_reconciliation_exceptions
CREATE TABLE `payable_reconciliation_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'ERROR', 'BLOCKER') NOT NULL,
    `category` ENUM('CONTROL_ACCOUNT_CONFIGURATION', 'SUBLEDGER_BALANCE', 'GENERAL_LEDGER_BALANCE', 'SOURCE_DOCUMENT', 'ACCOUNTING_VOUCHER', 'GENERAL_LEDGER_ENTRY', 'OPEN_ITEM', 'ALLOCATION', 'ALLOCATION_REVERSAL', 'DOCUMENT_REVERSAL', 'POSTING_EVENT', 'VENDOR_PARTY', 'CURRENCY', 'BRANCH', 'PERIOD_READINESS', 'WORKFLOW', 'DATA_INTEGRITY') NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `openItemId` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,
    `documentType` VARCHAR(64) NULL,
    `documentId` VARCHAR(191) NULL,
    `details` JSON NULL,
    `isAcknowledged` BOOLEAN NOT NULL DEFAULT false,
    `acknowledgedBy` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgementNote` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pay_recon_exc_le_idx`(`tenantId`, `legalEntityId`),
    INDEX `payable_reconciliation_exceptions_runId_idx`(`runId`),
    INDEX `pay_recon_exc_run_severity_idx`(`runId`, `severity`),
    INDEX `payable_reconciliation_exceptions_code_idx`(`code`),
    INDEX `payable_reconciliation_exceptions_vendorId_idx`(`vendorId`),
    INDEX `payable_reconciliation_exceptions_openItemId_idx`(`openItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_close_gate_runs
CREATE TABLE `payable_close_gate_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `asOfDate` DATE NOT NULL,
    `status` ENUM('PASS', 'PASS_WITH_WARNINGS', 'BLOCKED', 'FAILED') NOT NULL,
    `reconciliationRunId` VARCHAR(191) NULL,
    `checksTotal` INTEGER NOT NULL DEFAULT 0,
    `checksPassed` INTEGER NOT NULL DEFAULT 0,
    `checksWarning` INTEGER NOT NULL DEFAULT 0,
    `checksBlocked` INTEGER NOT NULL DEFAULT 0,
    `checksFailed` INTEGER NOT NULL DEFAULT 0,
    `summary` JSON NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payable_close_gate_runs_tenantId_idx`(`tenantId`),
    INDEX `payable_close_gate_runs_legalEntityId_idx`(`legalEntityId`),
    INDEX `pay_close_gate_le_period_idx`(`tenantId`, `legalEntityId`, `periodId`),
    INDEX `pay_close_gate_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `payable_close_gate_runs_periodId_idx`(`periodId`),
    INDEX `payable_close_gate_runs_reconciliationRunId_idx`(`reconciliationRunId`),
    INDEX `payable_close_gate_runs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable payable_close_gate_checks
CREATE TABLE `payable_close_gate_checks` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `checkCode` VARCHAR(64) NOT NULL,
    `checkName` VARCHAR(200) NOT NULL,
    `status` ENUM('PASSED', 'WARNING', 'BLOCKED', 'FAILED') NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pay_close_gate_chk_le_idx`(`tenantId`, `legalEntityId`),
    INDEX `payable_close_gate_checks_runId_idx`(`runId`),
    INDEX `payable_close_gate_checks_checkCode_idx`(`checkCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey payable_reconciliation_runs
ALTER TABLE `payable_reconciliation_runs` ADD CONSTRAINT `payable_reconciliation_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_runs` ADD CONSTRAINT `payable_reconciliation_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey payable_reconciliation_account_results
ALTER TABLE `payable_reconciliation_account_results` ADD CONSTRAINT `payable_reconciliation_account_results_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_account_results` ADD CONSTRAINT `payable_reconciliation_account_results_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_account_results` ADD CONSTRAINT `payable_reconciliation_account_results_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `payable_reconciliation_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_account_results` ADD CONSTRAINT `payable_reconciliation_account_results_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey payable_reconciliation_exceptions
ALTER TABLE `payable_reconciliation_exceptions` ADD CONSTRAINT `payable_reconciliation_exceptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_exceptions` ADD CONSTRAINT `payable_reconciliation_exceptions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_reconciliation_exceptions` ADD CONSTRAINT `payable_reconciliation_exceptions_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `payable_reconciliation_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey payable_close_gate_runs
ALTER TABLE `payable_close_gate_runs` ADD CONSTRAINT `payable_close_gate_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_close_gate_runs` ADD CONSTRAINT `payable_close_gate_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_close_gate_runs` ADD CONSTRAINT `payable_close_gate_runs_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_close_gate_runs` ADD CONSTRAINT `payable_close_gate_runs_reconciliationRunId_fkey` FOREIGN KEY (`reconciliationRunId`) REFERENCES `payable_reconciliation_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey payable_close_gate_checks
ALTER TABLE `payable_close_gate_checks` ADD CONSTRAINT `payable_close_gate_checks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_close_gate_checks` ADD CONSTRAINT `payable_close_gate_checks_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payable_close_gate_checks` ADD CONSTRAINT `payable_close_gate_checks_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `payable_close_gate_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
