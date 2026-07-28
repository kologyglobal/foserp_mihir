/* =========================================================
   MUST FIX — proforma tables for commercial/sync
   DB: u233611619_foserp  (click it in left sidebar first)
   ========================================================= */

SELECT DATABASE() AS db;

SELECT t.wanted AS table_name,
       CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (
  SELECT 'crm_payment_receipts' AS wanted UNION ALL
  SELECT 'crm_tax_invoices' UNION ALL
  SELECT 'crm_tax_invoice_lines' UNION ALL
  SELECT 'crm_payment_allocations' UNION ALL
  SELECT 'crm_proforma_invoices' UNION ALL
  SELECT 'crm_proforma_invoice_lines'
) t
LEFT JOIN information_schema.tables i
  ON i.table_schema = DATABASE() AND i.table_name = t.wanted
ORDER BY status DESC, table_name;

CREATE TABLE IF NOT EXISTS `crm_proforma_invoices` (
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
  INDEX `crm_proforma_invoices_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_proforma_invoice_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `proformaId` VARCHAR(191) NOT NULL,
  `lineNo` INTEGER NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
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
  INDEX `crm_proforma_invoice_lines_tenantId_itemId_idx`(`tenantId`, `itemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

/* Must show EXISTS for ALL 6 */
SELECT t.wanted AS table_name,
       CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (
  SELECT 'crm_payment_receipts' AS wanted UNION ALL
  SELECT 'crm_tax_invoices' UNION ALL
  SELECT 'crm_tax_invoice_lines' UNION ALL
  SELECT 'crm_payment_allocations' UNION ALL
  SELECT 'crm_proforma_invoices' UNION ALL
  SELECT 'crm_proforma_invoice_lines'
) t
LEFT JOIN information_schema.tables i
  ON i.table_schema = DATABASE() AND i.table_name = t.wanted
ORDER BY table_name;

SELECT COUNT(*) AS proformas FROM crm_proforma_invoices;
SELECT COUNT(*) AS proforma_lines FROM crm_proforma_invoice_lines;
