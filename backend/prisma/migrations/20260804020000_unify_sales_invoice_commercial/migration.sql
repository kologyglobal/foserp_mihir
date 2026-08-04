-- Unify CRM Tax Invoice + Money In Sales Invoice: commercial fields on sales_invoices
-- Canonical ledger = sales_invoices. crm_tax_invoices retained for historical redirect only.

-- Created-channel enum
ALTER TABLE `sales_invoices`
  ADD COLUMN `quotationId` VARCHAR(191) NULL,
  ADD COLUMN `quotationNo` VARCHAR(64) NULL,
  ADD COLUMN `proformaInvoiceId` VARCHAR(191) NULL,
  ADD COLUMN `proformaNo` VARCHAR(64) NULL,
  ADD COLUMN `salesOrderId` VARCHAR(191) NULL,
  ADD COLUMN `salesOrderNo` VARCHAR(64) NULL,
  ADD COLUMN `deliveryTerms` VARCHAR(500) NULL,
  ADD COLUMN `paymentTerms` VARCHAR(500) NULL,
  ADD COLUMN `legacyCrmTaxInvoiceId` VARCHAR(191) NULL,
  ADD COLUMN `legacyCrmInvoiceNo` VARCHAR(64) NULL,
  ADD COLUMN `createdChannel` ENUM('CRM', 'ACCOUNTING', 'DISPATCH', 'RECURRING') NOT NULL DEFAULT 'ACCOUNTING',
  ADD COLUMN `commercialMetadata` JSON NULL;

CREATE UNIQUE INDEX `sales_invoices_legacyCrmTaxInvoiceId_key` ON `sales_invoices`(`legacyCrmTaxInvoiceId`);
CREATE INDEX `sales_invoices_tenantId_createdChannel_idx` ON `sales_invoices`(`tenantId`, `createdChannel`);
CREATE INDEX `sales_invoices_tenantId_salesOrderId_idx` ON `sales_invoices`(`tenantId`, `salesOrderId`);
CREATE INDEX `sales_invoices_tenantId_legacyCrmInvoiceNo_idx` ON `sales_invoices`(`tenantId`, `legacyCrmInvoiceNo`);

-- Stamp converted CRM tax invoices onto existing SalesInvoice rows (no duplicates).
UPDATE `sales_invoices` si
INNER JOIN `crm_tax_invoices` cti
  ON cti.salesInvoiceId = si.id
 AND cti.tenantId = si.tenantId
 AND cti.deletedAt IS NULL
SET
  si.legacyCrmTaxInvoiceId = cti.id,
  si.legacyCrmInvoiceNo = cti.invoiceNo,
  si.createdChannel = 'CRM',
  si.quotationId = COALESCE(si.quotationId, cti.quotationId),
  si.quotationNo = COALESCE(si.quotationNo, cti.quotationNo),
  si.proformaInvoiceId = COALESCE(si.proformaInvoiceId, cti.proformaInvoiceId),
  si.proformaNo = COALESCE(si.proformaNo, cti.proformaNo),
  si.salesOrderId = COALESCE(si.salesOrderId, cti.salesOrderId),
  si.salesOrderNo = COALESCE(si.salesOrderNo, cti.salesOrderNo),
  si.deliveryTerms = COALESCE(si.deliveryTerms, cti.deliveryTerms),
  si.paymentTerms = COALESCE(si.paymentTerms, cti.paymentTerms),
  si.referenceNumber = COALESCE(si.referenceNumber, cti.invoiceNo)
WHERE si.legacyCrmTaxInvoiceId IS NULL;
