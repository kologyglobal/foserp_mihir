-- Finance Phase 5B3 — Treasury adjustments (bank charges/interest/direct debit-credit), statement
-- classification + posting rules, standing instructions (draft-only generation), bankbook/cashbook.
-- Additive only. Out of scope: AR/AP open items, FX, bank APIs, MT940, auto-post from statement.

-- Extend finance document numbering enum
ALTER TABLE `finance_number_series`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'RECEIPT',
    'PAYMENT',
    'CONTRA',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'OPENING_BALANCE',
    'REVERSAL',
    'SALES_INVOICE',
    'CUSTOMER_RECEIPT',
    'CUSTOMER_CREDIT_NOTE',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_DEBIT_NOTE',
    'VENDOR_CREDIT_ADJUSTMENT',
    'BANK_RECONCILIATION_MATCH',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE',
    'TREASURY_ADJUSTMENT'
  ) NOT NULL;

-- Extend finance approval document type enum
ALTER TABLE `finance_approval_requests`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'PAYMENT',
    'RECEIPT',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'PERIOD_REOPEN',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_ADJUSTMENT',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE',
    'TREASURY_ADJUSTMENT'
  ) NOT NULL;

-- Extend default account mapping key enum
ALTER TABLE `default_account_mappings`
  MODIFY COLUMN `mappingKey` ENUM(
    'CUSTOMER_RECEIVABLE',
    'VENDOR_PAYABLE',
    'SALES_REVENUE',
    'SALES_RETURN',
    'PURCHASE',
    'PURCHASE_RETURN',
    'RAW_MATERIAL_INVENTORY',
    'WIP_INVENTORY',
    'FINISHED_GOODS_INVENTORY',
    'STOCK_ADJUSTMENT',
    'MATERIAL_CONSUMPTION',
    'PRODUCTION_VARIANCE',
    'SCRAP_INVENTORY',
    'SCRAP_LOSS',
    'SUBCONTRACTING_EXPENSE',
    'FREIGHT_INWARD',
    'FREIGHT_OUTWARD',
    'GST_INPUT_CGST',
    'GST_INPUT_SGST',
    'GST_INPUT_IGST',
    'GST_OUTPUT_CGST',
    'GST_OUTPUT_SGST',
    'GST_OUTPUT_IGST',
    'GST_OUTPUT_CESS',
    'TDS_RECEIVABLE',
    'TDS_PAYABLE',
    'BANK_CHARGES',
    'ROUNDING',
    'DEPRECIATION_EXPENSE',
    'ACCUMULATED_DEPRECIATION',
    'ASSET_DISPOSAL_GAIN',
    'ASSET_DISPOSAL_LOSS',
    'RETAINED_EARNINGS',
    'INTERNAL_TRANSFER_CLEARING',
    'CHEQUE_RECEIPT_CLEARING',
    'CHEQUE_PAYMENT_CLEARING',
    'BANK_INTEREST_INCOME',
    'BANK_INTEREST_EXPENSE',
    'COLLECTION_FEE_EXPENSE',
    'MERCHANT_FEE_EXPENSE'
  ) NOT NULL;

-- AlterTable finance_settings — Phase 5B3 treasury adjustment policy
ALTER TABLE `finance_settings`
  ADD COLUMN `useTreasuryAdjustmentsForStatementItems` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `treasuryAdjustmentApprovalLimit` DECIMAL(18, 4) NULL,
  ADD COLUMN `treasuryAdjustmentPreventSelfApprove` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable bank_posting_rules
CREATE TABLE `bank_posting_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `direction` ENUM('CREDIT', 'DEBIT') NULL,
    `keywordPatterns` JSON NOT NULL,
    `minAmount` DECIMAL(18, 4) NULL,
    `maxAmount` DECIMAL(18, 4) NULL,
    `adjustmentType` ENUM('BANK_CHARGES', 'BANK_INTEREST_INCOME', 'BANK_INTEREST_EXPENSE', 'COLLECTION_FEE', 'MERCHANT_FEE', 'DIRECT_DEBIT', 'DIRECT_CREDIT', 'STANDING_INSTRUCTION_DEBIT', 'STANDING_INSTRUCTION_CREDIT', 'GST_ADJUSTMENT', 'OTHER_BANK_DEBIT', 'OTHER_BANK_CREDIT') NOT NULL,
    `lineTemplateJson` JSON NOT NULL,
    `matchCount` INTEGER NOT NULL DEFAULT 0,
    `lastMatchedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_posting_rules_tenantId_idx`(`tenantId`),
    INDEX `bank_posting_rule_scope_idx`(`tenantId`, `legalEntityId`, `isActive`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable standing_instructions
CREATE TABLE `standing_instructions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `adjustmentType` ENUM('BANK_CHARGES', 'BANK_INTEREST_INCOME', 'BANK_INTEREST_EXPENSE', 'COLLECTION_FEE', 'MERCHANT_FEE', 'DIRECT_DEBIT', 'DIRECT_CREDIT', 'STANDING_INSTRUCTION_DEBIT', 'STANDING_INSTRUCTION_CREDIT', 'GST_ADJUSTMENT', 'OTHER_BANK_DEBIT', 'OTHER_BANK_CREDIT') NOT NULL,
    `direction` ENUM('BANK_DEBIT', 'BANK_CREDIT') NOT NULL,
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY') NOT NULL,
    `amountMode` ENUM('FIXED', 'VARIABLE') NOT NULL,
    `fixedAmount` DECIMAL(18, 4) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `nextDueDate` DATE NOT NULL,
    `lineTemplateJson` JSON NOT NULL,
    `narrationTemplate` VARCHAR(500) NULL,
    `lastGeneratedAt` DATETIME(3) NULL,
    `lastGeneratedForDate` DATE NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `standing_instructions_tenantId_idx`(`tenantId`),
    INDEX `standing_instr_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `standing_instructions_nextDueDate_idx`(`nextDueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable standing_instruction_executions
CREATE TABLE `standing_instruction_executions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `standingInstructionId` VARCHAR(191) NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('PENDING', 'DRAFT_CREATED', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `treasuryAdjustmentId` VARCHAR(191) NULL,
    `failureReason` VARCHAR(500) NULL,
    `generatedAt` DATETIME(3) NULL,
    `generatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `standing_instruction_executions_treasuryAdjustmentId_key`(`treasuryAdjustmentId`),
    UNIQUE INDEX `standing_instr_exec_due_key`(`standingInstructionId`, `dueDate`),
    INDEX `standing_instruction_executions_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable treasury_adjustments
CREATE TABLE `treasury_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `glAccountId` VARCHAR(191) NOT NULL,
    `adjustmentType` ENUM('BANK_CHARGES', 'BANK_INTEREST_INCOME', 'BANK_INTEREST_EXPENSE', 'COLLECTION_FEE', 'MERCHANT_FEE', 'DIRECT_DEBIT', 'DIRECT_CREDIT', 'STANDING_INSTRUCTION_DEBIT', 'STANDING_INSTRUCTION_CREDIT', 'GST_ADJUSTMENT', 'OTHER_BANK_DEBIT', 'OTHER_BANK_CREDIT') NOT NULL,
    `direction` ENUM('BANK_DEBIT', 'BANK_CREDIT') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `sourceMode` ENUM('MANUAL', 'BANK_STATEMENT', 'STANDING_INSTRUCTION') NOT NULL DEFAULT 'MANUAL',
    `draftReference` VARCHAR(64) NOT NULL,
    `adjustmentNumber` VARCHAR(64) NULL,
    `adjustmentDate` DATE NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
    `bankAmount` DECIMAL(18, 4) NOT NULL,
    `baseBankAmount` DECIMAL(18, 4) NOT NULL,
    `bankStatementLineId` VARCHAR(191) NULL,
    `standingInstructionExecutionId` VARCHAR(191) NULL,
    `narration` TEXT NULL,
    `internalNote` TEXT NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,
    `calculationVersion` INTEGER NOT NULL DEFAULT 1,
    `validationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,
    `postingEventId` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,
    `reconciliationMatchId` VARCHAR(191) NULL,
    `reversalPostingEventId` VARCHAR(191) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,
    `uniquenessKey` VARCHAR(300) NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `readyAt` DATETIME(3) NULL,
    `readyById` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedById` VARCHAR(191) NULL,
    `reversalDate` DATE NULL,
    `reversalReason` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treasury_adjustments_bankStatementLineId_key`(`bankStatementLineId`),
    UNIQUE INDEX `treasury_adjustments_standingInstructionExecutionId_key`(`standingInstructionExecutionId`),
    UNIQUE INDEX `treasury_adjustments_uniquenessKey_key`(`uniquenessKey`),
    INDEX `treasury_adjustments_tenantId_idx`(`tenantId`),
    INDEX `treas_adj_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `treasury_adjustments_treasuryAccountId_idx`(`treasuryAccountId`),
    INDEX `treasury_adjustments_draftReference_idx`(`draftReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable treasury_adjustment_lines
CREATE TABLE `treasury_adjustment_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `treasuryAdjustmentId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `lineType` ENUM('EXPENSE', 'INCOME', 'ASSET', 'LIABILITY', 'RECOVERABLE_TAX', 'NON_RECOVERABLE_TAX', 'TDS_RECEIVABLE', 'ROUND_OFF', 'OTHER') NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `gstTreatment` ENUM('GST_APPLICABLE', 'GST_NOT_APPLICABLE', 'GST_NON_RECOVERABLE', 'GST_PENDING_REVIEW') NOT NULL DEFAULT 'GST_NOT_APPLICABLE',
    `gstRate` DECIMAL(5, 2) NULL,
    `tdsTreatment` ENUM('TDS_NOT_APPLICABLE', 'TDS_DEDUCTED', 'TDS_PENDING_REVIEW') NOT NULL DEFAULT 'TDS_NOT_APPLICABLE',
    `tdsRate` DECIMAL(5, 2) NULL,
    `narration` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treas_adj_line_num_key`(`treasuryAdjustmentId`, `lineNumber`),
    INDEX `treasury_adjustment_lines_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey bank_posting_rules
ALTER TABLE `bank_posting_rules` ADD CONSTRAINT `bank_posting_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_posting_rules` ADD CONSTRAINT `bank_posting_rules_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_posting_rules` ADD CONSTRAINT `bank_posting_rules_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey standing_instructions
ALTER TABLE `standing_instructions` ADD CONSTRAINT `standing_instructions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `standing_instructions` ADD CONSTRAINT `standing_instructions_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `standing_instructions` ADD CONSTRAINT `standing_instructions_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey standing_instruction_executions
ALTER TABLE `standing_instruction_executions` ADD CONSTRAINT `standing_instruction_executions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `standing_instruction_executions` ADD CONSTRAINT `standing_instruction_executions_standingInstructionId_fkey` FOREIGN KEY (`standingInstructionId`) REFERENCES `standing_instructions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey treasury_adjustments
ALTER TABLE `treasury_adjustments` ADD CONSTRAINT `treasury_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_adjustments` ADD CONSTRAINT `treasury_adjustments_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_adjustments` ADD CONSTRAINT `treasury_adjustments_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_adjustments` ADD CONSTRAINT `treasury_adjustments_bankStatementLineId_fkey` FOREIGN KEY (`bankStatementLineId`) REFERENCES `bank_statement_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey treasury_adjustment_lines
ALTER TABLE `treasury_adjustment_lines` ADD CONSTRAINT `treasury_adjustment_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_adjustment_lines` ADD CONSTRAINT `treasury_adjustment_lines_treasuryAdjustmentId_fkey` FOREIGN KEY (`treasuryAdjustmentId`) REFERENCES `treasury_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
