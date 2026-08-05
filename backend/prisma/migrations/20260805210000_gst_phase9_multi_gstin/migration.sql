-- Phase 9 — multi-GSTIN / multi-branch registration map + LE transfer policy

-- Legal entity branch-transfer tax policy
ALTER TABLE `legal_entities`
  ADD COLUMN `branchTransferTaxPolicy` ENUM(
    'NOT_CONFIGURED',
    'SAME_GSTIN_STOCK_NO_TAX',
    'CROSS_GSTIN_TAXABLE_SUPPLY',
    'PROHIBITED'
  ) NOT NULL DEFAULT 'NOT_CONFIGURED';

CREATE TABLE IF NOT EXISTS `gst_registrations` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `gstin` VARCHAR(20) NOT NULL,
  `stateCode` VARCHAR(8) NULL,
  `registrationType` VARCHAR(40) NOT NULL DEFAULT 'REGULAR',
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `seriesPrefix` VARCHAR(32) NULL,
  `placeOfSupplyDefault` VARCHAR(100) NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `notes` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `gst_reg_tenant_gstin_key`(`tenantId`, `gstin`),
  INDEX `gst_reg_le_idx`(`tenantId`, `legalEntityId`),
  INDEX `gst_reg_branch_idx`(`tenantId`, `branchId`),
  CONSTRAINT `gst_registrations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_registrations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_registrations_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
