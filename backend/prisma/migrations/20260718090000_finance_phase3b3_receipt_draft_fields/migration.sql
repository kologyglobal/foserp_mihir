-- Phase 3B3: Customer receipt draft persistence — TDS metadata, snapshots, calculationContext, deduction lines.
-- Non-destructive: additive columns + new table/enum only.

ALTER TABLE `customer_receipts`
  ADD COLUMN `customerGstinSnapshot` VARCHAR(20) NULL,
  ADD COLUMN `customerPanSnapshot` VARCHAR(20) NULL,
  ADD COLUMN `customerStateCodeSnapshot` VARCHAR(8) NULL,
  ADD COLUMN `customerCountryCodeSnapshot` VARCHAR(8) NULL,
  ADD COLUMN `customerBillingAddressSnapshot` JSON NULL,
  ADD COLUMN `sourceDocumentId` VARCHAR(191) NULL,
  ADD COLUMN `sourceDocumentNumberSnapshot` VARCHAR(64) NULL,
  ADD COLUMN `calculationContext` JSON NULL,
  ADD COLUMN `valueDate` DATE NULL,
  ADD COLUMN `tdsMode` VARCHAR(16) NULL,
  ADD COLUMN `tdsValue` DECIMAL(18, 4) NULL,
  ADD COLUMN `tdsCalculationBase` DECIMAL(18, 4) NULL,
  ADD COLUMN `tdsSectionCode` VARCHAR(32) NULL,
  ADD COLUMN `tdsCertificateReference` VARCHAR(64) NULL;

CREATE TABLE `customer_receipt_deduction_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `type` ENUM('BANK_CHARGE', 'OTHER_DEDUCTION') NOT NULL,
  `code` VARCHAR(32) NULL,
  `description` VARCHAR(200) NOT NULL,
  `amount` DECIMAL(18, 4) NOT NULL,
  `baseAmount` DECIMAL(18, 4) NOT NULL,
  `accountId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `cust_rcpt_ded_line_seq_key`(`tenantId`, `legalEntityId`, `receiptId`, `lineNumber`),
  INDEX `customer_receipt_deduction_lines_receiptId_idx`(`receiptId`),
  INDEX `customer_receipt_deduction_lines_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
  INDEX `customer_receipt_deduction_lines_accountId_idx`(`accountId`),
  INDEX `customer_receipt_deduction_lines_type_idx`(`type`),

  CONSTRAINT `customer_receipt_deduction_lines_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_deduction_lines_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_deduction_lines_receiptId_fkey`
    FOREIGN KEY (`receiptId`) REFERENCES `customer_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_receipt_deduction_lines_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
