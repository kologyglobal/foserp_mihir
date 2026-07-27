-- Tenant security policy + CRM org-scope columns for LE/branch list enforcement

CREATE TABLE `tenant_security_settings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `passwordMinLength` INTEGER NOT NULL DEFAULT 8,
  `maxFailedLogins` INTEGER NOT NULL DEFAULT 5,
  `requireComplexity` BOOLEAN NOT NULL DEFAULT false,
  `mfaMode` VARCHAR(32) NOT NULL DEFAULT 'off',
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tenant_security_settings_tenantId_key`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tenant_security_settings`
  ADD CONSTRAINT `tenant_security_settings_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `crm_leads`
  ADD COLUMN `legalEntityId` VARCHAR(191) NULL,
  ADD COLUMN `branchId` VARCHAR(191) NULL;

ALTER TABLE `crm_opportunities`
  ADD COLUMN `legalEntityId` VARCHAR(191) NULL,
  ADD COLUMN `branchId` VARCHAR(191) NULL;

ALTER TABLE `crm_quotations`
  ADD COLUMN `legalEntityId` VARCHAR(191) NULL,
  ADD COLUMN `branchId` VARCHAR(191) NULL;

ALTER TABLE `crm_sales_orders`
  ADD COLUMN `legalEntityId` VARCHAR(191) NULL,
  ADD COLUMN `branchId` VARCHAR(191) NULL;

CREATE INDEX `crm_leads_tenantId_legalEntityId_idx` ON `crm_leads`(`tenantId`, `legalEntityId`);
CREATE INDEX `crm_leads_tenantId_branchId_idx` ON `crm_leads`(`tenantId`, `branchId`);
CREATE INDEX `crm_opportunities_tenantId_legalEntityId_idx` ON `crm_opportunities`(`tenantId`, `legalEntityId`);
CREATE INDEX `crm_opportunities_tenantId_branchId_idx` ON `crm_opportunities`(`tenantId`, `branchId`);
CREATE INDEX `crm_quotations_tenantId_legalEntityId_idx` ON `crm_quotations`(`tenantId`, `legalEntityId`);
CREATE INDEX `crm_quotations_tenantId_branchId_idx` ON `crm_quotations`(`tenantId`, `branchId`);
CREATE INDEX `crm_sales_orders_tenantId_legalEntityId_idx` ON `crm_sales_orders`(`tenantId`, `legalEntityId`);
CREATE INDEX `crm_sales_orders_tenantId_branchId_idx` ON `crm_sales_orders`(`tenantId`, `branchId`);
