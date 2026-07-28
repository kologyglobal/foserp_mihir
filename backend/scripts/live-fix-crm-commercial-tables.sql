/* =========================================================
   LIVE FIX — CRM commercial tables (u233611619_foserp)
   Matches current Prisma: productId on tax invoice lines.
   No FKs (Hostinger-safe). Click DB u233611619_foserp first.
   ========================================================= */

SELECT DATABASE() AS db;

CREATE TABLE IF NOT EXISTS `crm_payment_receipts` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `receiptNo` VARCHAR(64) NOT NULL,
  `receiptDate` DATE NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `customerNameSnapshot` VARCHAR(300) NOT NULL,
  `proformaInvoiceId` VARCHAR(191) NULL,
  `proformaNo` VARCHAR(64) NULL,
  `paymentMode` ENUM('cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs') NOT NULL,
  `transactionRef` VARCHAR(120) NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `unallocatedAmount` DECIMAL(18, 2) NOT NULL,
  `remarks` TEXT NULL,
  `attachmentName` VARCHAR(255) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `crm_payment_receipts_tenantId_receiptNo_key`(`tenantId`, `receiptNo`),
  INDEX `crm_payment_receipts_tenantId_idx`(`tenantId`),
  INDEX `crm_payment_receipts_tenantId_companyId_idx`(`tenantId`, `companyId`),
  INDEX `crm_payment_receipts_tenantId_proformaInvoiceId_idx`(`tenantId`, `proformaInvoiceId`),
  INDEX `crm_payment_receipts_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_tax_invoices` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `invoiceNo` VARCHAR(64) NOT NULL,
  `invoiceDate` DATE NOT NULL,
  `dueDate` DATE NOT NULL,
  `status` ENUM('draft', 'posted', 'partially_paid', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
  `paymentStatus` ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid',
  `source` ENUM('sales_order', 'proforma', 'direct', 'manual') NOT NULL DEFAULT 'direct',
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
  `proformaInvoiceId` VARCHAR(191) NULL,
  `proformaNo` VARCHAR(64) NULL,
  `remarks` TEXT NULL,
  `taxableAmount` DECIMAL(18, 2) NOT NULL,
  `cgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `sgstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `igstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `totalTaxAmount` DECIMAL(18, 2) NOT NULL,
  `grandTotal` DECIMAL(18, 2) NOT NULL,
  `amountPaid` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `balanceDue` DECIMAL(18, 2) NOT NULL,
  `gstScheme` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst',
  `postedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `crm_tax_invoices_tenantId_invoiceNo_key`(`tenantId`, `invoiceNo`),
  INDEX `crm_tax_invoices_tenantId_idx`(`tenantId`),
  INDEX `crm_tax_invoices_tenantId_companyId_idx`(`tenantId`, `companyId`),
  INDEX `crm_tax_invoices_tenantId_salesOrderId_idx`(`tenantId`, `salesOrderId`),
  INDEX `crm_tax_invoices_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `crm_tax_invoices_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_tax_invoice_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `lineNo` INTEGER NOT NULL,
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
  INDEX `crm_tax_invoice_lines_tenantId_idx`(`tenantId`),
  INDEX `crm_tax_invoice_lines_invoiceId_idx`(`invoiceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_payment_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `receiptNo` VARCHAR(64) NOT NULL,
  `invoiceNo` VARCHAR(64) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(300) NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `allocationDate` DATE NOT NULL,
  `remarks` TEXT NULL,
  `reversedAt` DATETIME(3) NULL,
  `reversedBy` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `crm_payment_allocations_tenantId_idx`(`tenantId`),
  INDEX `crm_payment_allocations_tenantId_companyId_idx`(`tenantId`, `companyId`),
  INDEX `crm_payment_allocations_tenantId_receiptId_idx`(`tenantId`, `receiptId`),
  INDEX `crm_payment_allocations_tenantId_invoiceId_idx`(`tenantId`, `invoiceId`),
  INDEX `crm_payment_allocations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

/* Permissions */
INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'crm.commercial.view', 'crm', 'View CRM commercial receivables sync', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'crm.commercial.view');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` = 'crm.commercial.view'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );

/* VERIFY */
SELECT t.wanted AS table_name,
       CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (
  SELECT 'crm_payment_receipts' AS wanted UNION ALL
  SELECT 'crm_tax_invoices' UNION ALL
  SELECT 'crm_tax_invoice_lines' UNION ALL
  SELECT 'crm_payment_allocations'
) t
LEFT JOIN information_schema.tables i
  ON i.table_schema = DATABASE() AND i.table_name = t.wanted
ORDER BY table_name;

SELECT
  need.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'productId' AS column_name UNION ALL
  SELECT 'invoiceId' UNION ALL
  SELECT 'itemCode' UNION ALL
  SELECT 'deletedAt'
) AS need
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = DATABASE()
 AND c.table_name = 'crm_tax_invoice_lines'
 AND c.column_name = need.column_name;
