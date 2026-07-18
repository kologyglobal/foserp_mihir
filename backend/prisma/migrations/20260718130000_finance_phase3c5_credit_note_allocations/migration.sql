-- Phase 3C5: Credit note allocation to invoice DEBIT open items.
-- Subledger-only — does not touch AccountingVoucher, GL, PostingEvent, or number series.
-- Non-destructive additive migration.

ALTER TABLE `customer_credit_notes`
  ADD COLUMN `allocatableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `allocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `unallocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `baseAllocatableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `baseUnallocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0;

CREATE TABLE `customer_credit_note_allocation_batches` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `creditNoteId` VARCHAR(191) NOT NULL,
  `creditNoteOpenItemId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `payloadHash` VARCHAR(128) NOT NULL,
  `status` ENUM('PROCESSING', 'POSTED', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
  `allocationDate` DATE NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
  `totalAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `baseTotalAllocatedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `allocationCount` INTEGER NOT NULL DEFAULT 0,
  `attemptCount` INTEGER NOT NULL DEFAULT 1,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `failedAt` DATETIME(3) NULL,
  `failureCode` VARCHAR(64) NULL,
  `failureMessage` VARCHAR(500) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `cust_cn_alloc_batch_idem_key`(`tenantId`, `creditNoteId`, `idempotencyKey`),
  INDEX `customer_credit_note_allocation_batches_tenantId_legalEntity_idx`(`tenantId`, `legalEntityId`),
  INDEX `customer_credit_note_allocation_batches_creditNoteId_idx`(`creditNoteId`),
  INDEX `customer_credit_note_allocation_batches_creditNoteOpenItem_idx`(`creditNoteOpenItemId`),
  INDEX `customer_credit_note_allocation_batches_customerId_idx`(`customerId`),
  INDEX `customer_credit_note_allocation_batches_status_idx`(`status`),
  INDEX `customer_credit_note_allocation_batches_allocationDate_idx`(`allocationDate`),
  INDEX `customer_credit_note_allocation_batches_createdAt_idx`(`createdAt`),

  CONSTRAINT `customer_credit_note_allocation_batches_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocation_batches_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocation_batches_creditNoteId_fkey`
    FOREIGN KEY (`creditNoteId`) REFERENCES `customer_credit_notes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocation_batches_creditNoteOpenIt_fkey`
    FOREIGN KEY (`creditNoteOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_credit_note_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NULL,
  `creditNoteId` VARCHAR(191) NOT NULL,
  `creditNoteOpenItemId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `invoiceOpenItemId` VARCHAR(191) NOT NULL,
  `allocationDate` DATE NOT NULL,
  `postingDate` DATE NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `exchangeRate` DECIMAL(18, 8) NOT NULL DEFAULT 1,
  `allocatedAmount` DECIMAL(18, 4) NOT NULL,
  `baseAllocatedAmount` DECIMAL(18, 4) NOT NULL,
  `invoiceOutstandingBefore` DECIMAL(18, 4) NULL,
  `invoiceOutstandingAfter` DECIMAL(18, 4) NULL,
  `baseInvoiceOutstandingBefore` DECIMAL(18, 4) NULL,
  `baseInvoiceOutstandingAfter` DECIMAL(18, 4) NULL,
  `status` ENUM('DRAFT', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
  `allocationSequence` INTEGER NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `reversalReason` VARCHAR(500) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `cust_cn_alloc_seq_key`(`tenantId`, `legalEntityId`, `creditNoteId`, `allocationSequence`),
  UNIQUE INDEX `cust_cn_alloc_batch_seq_key`(`batchId`, `allocationSequence`),
  INDEX `customer_credit_note_allocations_creditNoteId_idx`(`creditNoteId`),
  INDEX `customer_credit_note_allocations_invoiceId_idx`(`invoiceId`),
  INDEX `customer_credit_note_allocations_creditNoteOpenItemId_idx`(`creditNoteOpenItemId`),
  INDEX `customer_credit_note_allocations_invoiceOpenItemId_idx`(`invoiceOpenItemId`),
  INDEX `customer_credit_note_allocations_customerId_idx`(`customerId`),
  INDEX `customer_credit_note_allocations_status_idx`(`status`),
  INDEX `customer_credit_note_allocations_allocationDate_idx`(`allocationDate`),
  INDEX `customer_credit_note_allocations_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
  INDEX `customer_credit_note_allocations_batchId_idx`(`batchId`),

  CONSTRAINT `customer_credit_note_allocations_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `customer_credit_note_allocation_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_creditNoteId_fkey`
    FOREIGN KEY (`creditNoteId`) REFERENCES `customer_credit_notes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_creditNoteOpenItemId_fkey`
    FOREIGN KEY (`creditNoteOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_credit_note_allocations_invoiceOpenItemId_fkey`
    FOREIGN KEY (`invoiceOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
