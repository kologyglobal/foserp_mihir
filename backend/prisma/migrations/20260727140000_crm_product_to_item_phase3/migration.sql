-- Phase 3: nullable itemId on CRM quotation / sales order headers (keep productId for dual-read)
ALTER TABLE `crm_quotations` ADD COLUMN `itemId` VARCHAR(191) NULL;
ALTER TABLE `crm_sales_orders` ADD COLUMN `itemId` VARCHAR(191) NULL;

CREATE INDEX `crm_quotations_tenantId_itemId_idx` ON `crm_quotations`(`tenantId`, `itemId`);
CREATE INDEX `crm_sales_orders_tenantId_itemId_idx` ON `crm_sales_orders`(`tenantId`, `itemId`);
