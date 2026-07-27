-- CRM Proforma invoices (persisted; replaces demo-only localStorage proformas)

CREATE TABLE `crm_proforma_invoices` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `proformaNo` VARCHAR(64) NOT NULL,
  `proformaDate` DATE NOT NULL,
  `validUntil` DATE NOT NULL,
  `status` ENUM('draft', 'issued', 'cancelled') NOT NULL DEFAULT 'draft',
  `source` ENUM('direct', 'sales_order') NOT NULL DEFAULT 'direct',
  `companyId` VARCHAR(191) NOT NULL,
  `customerNameSnapshot` VARCHAR(300) NOT NULL,
  `customerGstin` VARCHAR(20) NULL,
  `customerState` VARCHAR(100) NULL,
  `customerAddress` TEXT NULL,
  `placeOfSupply` VARCHAR(100) NULL,
  `billingAddress` TEXT NULL,
  `shippingAddress` TEXT NULL,
  `deliveryTerms` VARCHAR(500) NULL,
  `paymentTerms` VARCHAR(500) NULL,
  `customerPoNumber` VARCHAR(100) NULL,
  `salesOrderId` VARCHAR(191) NULL,
  `salesOrderNo` VARCHAR(64) NULL,
  `quotationId` VARCHAR(191) NULL,
  `quotationNo` VARCHAR(64) NULL,
  `locationId` VARCHAR(191) NULL,
  `remarks` TEXT NULL,
  `taxableAmount` DECIMAL(18, 2) NOT NULL,
  `cgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `sgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `igstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalTaxAmount` DECIMAL(18, 2) NOT NULL,
  `grandTotal` DECIMAL(18, 2) NOT NULL,
  `gstScheme` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst',
  `issuedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `crm_proforma_invoices_tenantId_proformaNo_key`(`tenantId`, `proformaNo`),
  INDEX `crm_proforma_invoices_tenantId_idx`(`tenantId`),
  INDEX `crm_proforma_invoices_tenantId_companyId_idx`(`tenantId`, `companyId`),
  INDEX `crm_proforma_invoices_tenantId_salesOrderId_idx`(`tenantId`, `salesOrderId`),
  INDEX `crm_proforma_invoices_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `crm_proforma_invoices_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  CONSTRAINT `crm_proforma_invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `crm_proforma_invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `crm_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `crm_proforma_invoice_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `proformaId` VARCHAR(191) NOT NULL,
  `lineNo` INT NOT NULL,
  `productId` VARCHAR(191) NULL,
  `itemCode` VARCHAR(64) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `hsnCode` VARCHAR(16) NULL,
  `qty` DECIMAL(18, 4) NOT NULL,
  `uom` VARCHAR(16) NOT NULL DEFAULT 'NOS',
  `unitPrice` DECIMAL(18, 2) NOT NULL,
  `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `taxPct` DECIMAL(5, 2) NOT NULL DEFAULT 18,
  `taxableValue` DECIMAL(18, 2) NOT NULL,
  `gstAmount` DECIMAL(18, 2) NOT NULL,
  `lineTotal` DECIMAL(18, 2) NOT NULL,
  `sourceLineId` VARCHAR(191) NULL,
  `maxQty` DECIMAL(18, 4) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `crm_proforma_invoice_lines_tenantId_idx`(`tenantId`),
  INDEX `crm_proforma_invoice_lines_proformaId_idx`(`proformaId`),
  CONSTRAINT `crm_proforma_invoice_lines_proformaId_fkey` FOREIGN KEY (`proformaId`) REFERENCES `crm_proforma_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Clear orphan proforma links from demo/local ids before FK
UPDATE `crm_payment_receipts`
SET `proformaInvoiceId` = NULL, `proformaNo` = NULL
WHERE `proformaInvoiceId` IS NOT NULL;

ALTER TABLE `crm_payment_receipts`
  ADD CONSTRAINT `crm_payment_receipts_proformaInvoiceId_fkey`
  FOREIGN KEY (`proformaInvoiceId`) REFERENCES `crm_proforma_invoices`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
