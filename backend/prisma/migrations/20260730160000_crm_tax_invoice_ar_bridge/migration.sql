-- CRM Tax Invoice ↔ Money In AR bridge

ALTER TABLE `crm_tax_invoices`
  ADD COLUMN `accountingStatus` ENUM('none', 'pending_review', 'converted', 'rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN `salesInvoiceId` VARCHAR(191) NULL,
  ADD COLUMN `salesInvoiceNumber` VARCHAR(64) NULL,
  ADD COLUMN `accountingSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `accountingConvertedAt` DATETIME(3) NULL,
  ADD COLUMN `createdByNameSnapshot` VARCHAR(200) NULL;

CREATE INDEX `crm_tax_invoices_tenantId_accountingStatus_idx` ON `crm_tax_invoices`(`tenantId`, `accountingStatus`);
CREATE UNIQUE INDEX `crm_tax_invoices_tenantId_salesInvoiceId_key` ON `crm_tax_invoices`(`tenantId`, `salesInvoiceId`);

ALTER TABLE `sales_invoices`
  MODIFY COLUMN `sourceType` ENUM('DIRECT', 'SALES_ORDER', 'OUTBOUND_DISPATCH', 'CRM_TAX_INVOICE') NOT NULL DEFAULT 'DIRECT';

-- Existing posted CRM tax invoices enter Accounting review queue
UPDATE `crm_tax_invoices`
SET
  `accountingStatus` = 'pending_review',
  `accountingSubmittedAt` = COALESCE(`postedAt`, `createdAt`)
WHERE `deletedAt` IS NULL
  AND `status` IN ('posted', 'partially_paid', 'paid')
  AND `salesInvoiceId` IS NULL
  AND `accountingStatus` = 'none';
