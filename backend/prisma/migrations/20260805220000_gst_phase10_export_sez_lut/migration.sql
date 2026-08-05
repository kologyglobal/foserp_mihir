-- Phase 10 — Export / SEZ / LUT masters + sales-invoice zero-rated shipping fields + refund foundation

-- LUT (Letter of Undertaking) bond master per legal entity / GSTIN
CREATE TABLE IF NOT EXISTS `gst_luts` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `lutNumber` VARCHAR(64) NOT NULL,
  `financialYearLabel` VARCHAR(16) NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `notes` VARCHAR(1000) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `gst_lut_tenant_le_number_key`(`tenantId`, `legalEntityId`, `lutNumber`),
  INDEX `gst_lut_le_active_idx`(`tenantId`, `legalEntityId`, `isActive`),
  INDEX `gst_lut_gstin_idx`(`tenantId`, `companyGstin`),
  CONSTRAINT `gst_luts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_luts_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Export refund claim foundation (books-only; not portal RFD filing)
CREATE TABLE IF NOT EXISTS `gst_export_refund_claims` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `returnPeriod` VARCHAR(7) NOT NULL,
  `claimType` ENUM('IGST_REFUND', 'ITC_REFUND', 'OTHER') NOT NULL DEFAULT 'IGST_REFUND',
  `status` ENUM('DRAFT', 'PREPARED', 'SUBMITTED_EXTERNAL', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `taxableValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `igstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `externalArn` VARCHAR(64) NULL,
  `notes` VARCHAR(1000) NULL,
  `snapshotJson` JSON NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gst_exp_refund_le_period_idx`(`tenantId`, `legalEntityId`, `returnPeriod`),
  INDEX `gst_exp_refund_status_idx`(`tenantId`, `status`),
  CONSTRAINT `gst_export_refund_claims_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_export_refund_claims_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Sales invoice export / SEZ shipping snapshot fields
ALTER TABLE `sales_invoices`
  ADD COLUMN `lutId` VARCHAR(191) NULL,
  ADD COLUMN `lutNumberSnapshot` VARCHAR(64) NULL,
  ADD COLUMN `shippingBillNumber` VARCHAR(64) NULL,
  ADD COLUMN `shippingBillDate` DATE NULL,
  ADD COLUMN `shippingPortCode` VARCHAR(16) NULL,
  ADD COLUMN `exportFobValue` DECIMAL(18, 4) NULL;

CREATE INDEX `sales_inv_lut_idx` ON `sales_invoices`(`tenantId`, `lutId`);
