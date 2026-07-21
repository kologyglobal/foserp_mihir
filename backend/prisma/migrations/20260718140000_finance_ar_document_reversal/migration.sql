-- Phase 3B6/3C6: AR document + allocation reversal.
-- Adds REVERSED lifecycle states, reversal audit/link columns on receipt & credit-note headers,
-- and reverse-idempotency columns on both allocation batch tables.
-- Non-destructive additive migration.

-- Extend header status enums with REVERSED.
ALTER TABLE `customer_receipts`
  MODIFY COLUMN `status` ENUM('DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `customer_credit_notes`
  MODIFY COLUMN `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'READY_TO_POST', 'POSTED', 'REJECTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT';

-- Extend allocation batch status enums with REVERSED.
ALTER TABLE `customer_receipt_allocation_batches`
  MODIFY COLUMN `status` ENUM('PROCESSING', 'POSTED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'PROCESSING';

ALTER TABLE `customer_credit_note_allocation_batches`
  MODIFY COLUMN `status` ENUM('PROCESSING', 'POSTED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'PROCESSING';

-- Receipt header reversal columns.
ALTER TABLE `customer_receipts`
  ADD COLUMN `reversalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `customer_receipts_reversalVoucherId_key` ON `customer_receipts`(`reversalVoucherId`);

ALTER TABLE `customer_receipts`
  ADD CONSTRAINT `customer_receipts_reversalVoucherId_fkey`
    FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Credit-note header reversal columns.
ALTER TABLE `customer_credit_notes`
  ADD COLUMN `reversalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `customer_credit_notes_reversalVoucherId_key` ON `customer_credit_notes`(`reversalVoucherId`);

ALTER TABLE `customer_credit_notes`
  ADD CONSTRAINT `customer_credit_notes_reversalVoucherId_fkey`
    FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Receipt allocation batch reverse idempotency + audit columns.
ALTER TABLE `customer_receipt_allocation_batches`
  ADD COLUMN `reverseIdempotencyKey` VARCHAR(128) NULL,
  ADD COLUMN `reversePayloadHash` VARCHAR(128) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `cust_rcpt_alloc_batch_rev_idem_key`
  ON `customer_receipt_allocation_batches`(`tenantId`, `receiptId`, `reverseIdempotencyKey`);

-- Credit-note allocation batch reverse idempotency + audit columns.
ALTER TABLE `customer_credit_note_allocation_batches`
  ADD COLUMN `reverseIdempotencyKey` VARCHAR(128) NULL,
  ADD COLUMN `reversePayloadHash` VARCHAR(128) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `cust_cn_alloc_batch_rev_idem_key`
  ON `customer_credit_note_allocation_batches`(`tenantId`, `creditNoteId`, `reverseIdempotencyKey`);
