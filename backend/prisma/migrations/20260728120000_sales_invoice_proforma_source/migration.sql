-- AlterEnum SalesInvoiceSourceType: add PROFORMA_INVOICE so Money-In tax invoices can be
-- created directly from an issued CRM proforma invoice (services/Kology "Create Tax Invoice" flow).
ALTER TABLE `sales_invoices` MODIFY COLUMN `sourceType` ENUM('DIRECT', 'SALES_ORDER', 'OUTBOUND_DISPATCH', 'PROFORMA_INVOICE') NOT NULL DEFAULT 'DIRECT';
