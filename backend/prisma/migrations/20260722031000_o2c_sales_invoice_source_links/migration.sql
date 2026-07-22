-- Order-to-Cash Wave 1: Sales Invoice source-link qty ledger + project snapshots

-- AlterEnum SalesInvoiceSourceType
ALTER TABLE `sales_invoices` MODIFY COLUMN `sourceType` ENUM('DIRECT', 'SALES_ORDER', 'OUTBOUND_DISPATCH') NOT NULL DEFAULT 'DIRECT';

-- SalesInvoice project snapshots
ALTER TABLE `sales_invoices`
  ADD COLUMN `projectRef` VARCHAR(100) NULL,
  ADD COLUMN `projectNameSnapshot` VARCHAR(200) NULL;

-- SalesInvoiceLine project snapshots
ALTER TABLE `sales_invoice_lines`
  ADD COLUMN `projectRef` VARCHAR(100) NULL,
  ADD COLUMN `projectNameSnapshot` VARCHAR(200) NULL;

-- CrmSalesOrder project snapshots
ALTER TABLE `crm_sales_orders`
  ADD COLUMN `projectRef` VARCHAR(100) NULL,
  ADD COLUMN `projectNameSnapshot` VARCHAR(200) NULL;

-- CreateTable sales_invoice_source_links
CREATE TABLE `sales_invoice_source_links` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `salesInvoiceId` VARCHAR(191) NOT NULL,
    `salesInvoiceLineId` VARCHAR(191) NULL,
    `sourceType` ENUM('SALES_ORDER', 'OUTBOUND_DISPATCH', 'DELIVERY_CHALLAN') NOT NULL,
    `sourceDocumentId` VARCHAR(191) NOT NULL,
    `sourceLineId` VARCHAR(64) NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `salesOrderLineId` VARCHAR(64) NULL,
    `deliveryChallanId` VARCHAR(191) NULL,
    `deliveryChallanLineId` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `status` ENUM('ACTIVE', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
    `sourceDocumentNumberSnapshot` VARCHAR(64) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NULL,
    `itemNameSnapshot` VARCHAR(300) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sales_invoice_source_links_tenantId_idx`(`tenantId`),
    INDEX `sales_invoice_source_links_legalEntityId_idx`(`legalEntityId`),
    INDEX `sales_invoice_source_links_salesInvoiceId_idx`(`salesInvoiceId`),
    INDEX `sales_invoice_source_links_salesInvoiceLineId_idx`(`salesInvoiceLineId`),
    INDEX `si_src_link_consume_idx`(`status`, `sourceType`, `sourceDocumentId`, `sourceLineId`),
    INDEX `si_src_link_so_line_idx`(`tenantId`, `salesOrderId`, `salesOrderLineId`),
    INDEX `si_src_link_doc_idx`(`tenantId`, `sourceType`, `sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_invoice_source_links`
  ADD CONSTRAINT `sales_invoice_source_links_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_invoice_source_links_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_invoice_source_links_salesInvoiceId_fkey`
    FOREIGN KEY (`salesInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_invoice_source_links_salesInvoiceLineId_fkey`
    FOREIGN KEY (`salesInvoiceLineId`) REFERENCES `sales_invoice_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
