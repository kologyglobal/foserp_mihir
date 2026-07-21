-- Phase 4C1: AP allocation reversal history + vendor payment/invoice reversal links.
-- Non-destructive additive migration.

-- Vendor invoice reversal columns.
ALTER TABLE `vendor_invoices`
  ADD COLUMN `reversalDate` DATE NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL,
  ADD COLUMN `reversalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `reversalPostingEventId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `vendor_invoices_reversalVoucherId_key` ON `vendor_invoices`(`reversalVoucherId`);
CREATE UNIQUE INDEX `vendor_invoices_reversalPostingEventId_key` ON `vendor_invoices`(`reversalPostingEventId`);

ALTER TABLE `vendor_invoices`
  ADD CONSTRAINT `vendor_invoices_reversalVoucherId_fkey`
    FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `vendor_invoices_reversalPostingEventId_fkey`
    FOREIGN KEY (`reversalPostingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Vendor payment reversal columns.
ALTER TABLE `vendor_payments`
  ADD COLUMN `reversalDate` DATE NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL,
  ADD COLUMN `reversalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `reversalPostingEventId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `vendor_payments_reversalVoucherId_key` ON `vendor_payments`(`reversalVoucherId`);
CREATE UNIQUE INDEX `vendor_payments_reversalPostingEventId_key` ON `vendor_payments`(`reversalPostingEventId`);

ALTER TABLE `vendor_payments`
  ADD CONSTRAINT `vendor_payments_reversalVoucherId_fkey`
    FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `vendor_payments_reversalPostingEventId_fkey`
    FOREIGN KEY (`reversalPostingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Immutable allocation-reversal history (no GL).
CREATE TABLE `payable_allocation_reversal_batches` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `allocationBatchId` VARCHAR(191) NOT NULL,
  `reversalReference` VARCHAR(64) NOT NULL,
  `reversalDate` DATE NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `totalReversedAmount` DECIMAL(18, 4) NOT NULL,
  `baseTotalReversedAmount` DECIMAL(18, 4) NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `payloadHash` VARCHAR(128) NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `payable_allocation_reversal_batches_idempotencyKey_key`
  ON `payable_allocation_reversal_batches`(`idempotencyKey`);
CREATE UNIQUE INDEX `pay_alloc_rev_batch_ref_key`
  ON `payable_allocation_reversal_batches`(`tenantId`, `reversalReference`);
CREATE INDEX `pay_alloc_rev_batch_le_idx`
  ON `payable_allocation_reversal_batches`(`tenantId`, `legalEntityId`);
CREATE INDEX `pay_alloc_rev_batch_vendor_idx`
  ON `payable_allocation_reversal_batches`(`tenantId`, `legalEntityId`, `vendorId`);
CREATE INDEX `pay_alloc_rev_batch_alloc_idx`
  ON `payable_allocation_reversal_batches`(`allocationBatchId`);
CREATE INDEX `pay_alloc_rev_batch_date_idx`
  ON `payable_allocation_reversal_batches`(`reversalDate`);
CREATE INDEX `pay_alloc_rev_batch_created_idx`
  ON `payable_allocation_reversal_batches`(`createdAt`);

ALTER TABLE `payable_allocation_reversal_batches`
  ADD CONSTRAINT `payable_allocation_reversal_batches_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_batches_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_batches_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_batches_allocationBatchId_fkey`
    FOREIGN KEY (`allocationBatchId`) REFERENCES `payable_allocation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `payable_allocation_reversal_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `reversalBatchId` VARCHAR(191) NOT NULL,
  `allocationLineId` VARCHAR(191) NOT NULL,
  `sourceDebitOpenItemId` VARCHAR(191) NOT NULL,
  `targetCreditOpenItemId` VARCHAR(191) NOT NULL,
  `reversedAmount` DECIMAL(18, 4) NOT NULL,
  `baseReversedAmount` DECIMAL(18, 4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `pay_alloc_rev_line_le_idx`
  ON `payable_allocation_reversal_lines`(`tenantId`, `legalEntityId`);
CREATE INDEX `pay_alloc_rev_line_batch_idx`
  ON `payable_allocation_reversal_lines`(`reversalBatchId`);
CREATE INDEX `pay_alloc_rev_line_alloc_idx`
  ON `payable_allocation_reversal_lines`(`allocationLineId`);
CREATE INDEX `pay_alloc_rev_line_debit_idx`
  ON `payable_allocation_reversal_lines`(`sourceDebitOpenItemId`);
CREATE INDEX `pay_alloc_rev_line_credit_idx`
  ON `payable_allocation_reversal_lines`(`targetCreditOpenItemId`);

ALTER TABLE `payable_allocation_reversal_lines`
  ADD CONSTRAINT `payable_allocation_reversal_lines_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_lines_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_lines_reversalBatchId_fkey`
    FOREIGN KEY (`reversalBatchId`) REFERENCES `payable_allocation_reversal_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_lines_allocationLineId_fkey`
    FOREIGN KEY (`allocationLineId`) REFERENCES `payable_allocation_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_lines_sourceDebitOpenItemId_fkey`
    FOREIGN KEY (`sourceDebitOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payable_allocation_reversal_lines_targetCreditOpenItemId_fkey`
    FOREIGN KEY (`targetCreditOpenItemId`) REFERENCES `payable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
