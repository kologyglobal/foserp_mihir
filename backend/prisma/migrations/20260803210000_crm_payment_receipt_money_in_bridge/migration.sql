-- CRM payment receipt ↔ Money In handoff + CRM TI lastPaymentDate mirror

-- CustomerReceipt source type: CRM commercial receipt provenance
ALTER TABLE `customer_receipts`
  MODIFY COLUMN `sourceType` ENUM('DIRECT', 'BANK_IMPORT', 'CRM_PAYMENT_RECEIPT') NOT NULL DEFAULT 'DIRECT';

-- Idempotent source key for CRM_PAYMENT_RECEIPT (multiple NULLs still allowed for DIRECT)
CREATE UNIQUE INDEX `cust_rcpt_tenant_source_key` ON `customer_receipts`(`tenantId`, `sourceType`, `sourceDocumentId`);
CREATE INDEX `cust_rcpt_src_doc_idx` ON `customer_receipts`(`tenantId`, `sourceType`, `sourceDocumentId`);

-- CRM tax invoice payment mirror
ALTER TABLE `crm_tax_invoices`
  ADD COLUMN `lastPaymentDate` DATE NULL;

-- CRM payment receipt accounting linkage (no auto-convert of history)
ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingReceiptId` VARCHAR(191) NULL,
  ADD COLUMN `accountingMigrationStatus` ENUM(
    'UNREVIEWED',
    'NON_ACCOUNTING',
    'READY_TO_MIGRATE',
    'DRAFT_CREATED',
    'MIGRATED',
    'DUPLICATE',
    'REJECTED',
    'FAILED'
  ) NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN `accountingMigrationError` TEXT NULL,
  ADD COLUMN `accountingMigratedAt` DATETIME(3) NULL,
  ADD COLUMN `accountingMigratedBy` VARCHAR(191) NULL,
  ADD COLUMN `commercialOnly` BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX `crm_payment_receipts_tenantId_accountingReceiptId_key`
  ON `crm_payment_receipts`(`tenantId`, `accountingReceiptId`);
CREATE INDEX `crm_payment_receipts_tenantId_accountingReceiptId_idx`
  ON `crm_payment_receipts`(`tenantId`, `accountingReceiptId`);
CREATE INDEX `crm_payment_receipts_tenantId_accountingMigrationStatus_idx`
  ON `crm_payment_receipts`(`tenantId`, `accountingMigrationStatus`);
CREATE INDEX `crm_payment_receipts_tenantId_receiptDate_idx`
  ON `crm_payment_receipts`(`tenantId`, `receiptDate`);
CREATE INDEX `crm_payment_receipts_tenantId_transactionRef_idx`
  ON `crm_payment_receipts`(`tenantId`, `transactionRef`);
