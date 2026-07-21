-- Phase 3B5: Receipt allocation batches + open-item settledAt + allocation snapshots.
-- Non-destructive additive migration.

ALTER TABLE `receivable_open_items`
  ADD COLUMN `settledAt` DATETIME(3) NULL;

CREATE TABLE `customer_receipt_allocation_batches` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `receiptOpenItemId` VARCHAR(191) NOT NULL,
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
  UNIQUE INDEX `cust_rcpt_alloc_batch_idem_key`(`tenantId`, `receiptId`, `idempotencyKey`),
  INDEX `customer_receipt_allocation_batches_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
  INDEX `customer_receipt_allocation_batches_receiptId_idx`(`receiptId`),
  INDEX `customer_receipt_allocation_batches_receiptOpenItemId_idx`(`receiptOpenItemId`),
  INDEX `customer_receipt_allocation_batches_customerId_idx`(`customerId`),
  INDEX `customer_receipt_allocation_batches_status_idx`(`status`),
  INDEX `customer_receipt_allocation_batches_allocationDate_idx`(`allocationDate`),
  INDEX `customer_receipt_allocation_batches_createdAt_idx`(`createdAt`),

  CONSTRAINT `customer_receipt_allocation_batches_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_allocation_batches_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_allocation_batches_receiptId_fkey`
    FOREIGN KEY (`receiptId`) REFERENCES `customer_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_allocation_batches_receiptOpenItemId_fkey`
    FOREIGN KEY (`receiptOpenItemId`) REFERENCES `receivable_open_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_receipt_allocations`
  ADD COLUMN `batchId` VARCHAR(191) NULL,
  ADD COLUMN `invoiceOutstandingBefore` DECIMAL(18, 4) NULL,
  ADD COLUMN `invoiceOutstandingAfter` DECIMAL(18, 4) NULL,
  ADD COLUMN `baseInvoiceOutstandingBefore` DECIMAL(18, 4) NULL,
  ADD COLUMN `baseInvoiceOutstandingAfter` DECIMAL(18, 4) NULL,
  ADD INDEX `customer_receipt_allocations_batchId_idx`(`batchId`),
  ADD UNIQUE INDEX `cust_rcpt_alloc_batch_seq_key`(`batchId`, `allocationSequence`),
  ADD CONSTRAINT `customer_receipt_allocations_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `customer_receipt_allocation_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
