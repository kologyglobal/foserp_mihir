-- Phase 11 — GST special schemes / special flows (books-side).
-- Not portal filing · not FULL GST COMPLIANT · not Income-tax TDS engine.
-- Note: Phase 10 uses 20260805220000_gst_phase10_export_sez_lut — this must run after it.

-- Ledger supply class for nil/exempt/non-GST visibility + filter
ALTER TABLE `gst_ledger_entries`
  ADD COLUMN `supplyClass` VARCHAR(32) NULL;

CREATE INDEX `gst_ledger_supply_class_idx` ON `gst_ledger_entries`(`tenantId`, `legalEntityId`, `supplyClass`);

-- GST TDS / TCS (Sec 51 / 52 style) books register
CREATE TABLE IF NOT EXISTS `gst_withholding_entries` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `kind` ENUM('GST_TDS', 'GST_TCS') NOT NULL,
  `status` ENUM('OPEN', 'PAID', 'ADJUSTED', 'VOID') NOT NULL DEFAULT 'OPEN',
  `returnPeriod` VARCHAR(7) NOT NULL,
  `documentDate` DATE NOT NULL,
  `partyName` VARCHAR(300) NOT NULL,
  `partyGstin` VARCHAR(20) NULL,
  `partyId` VARCHAR(191) NULL,
  `sourceDocumentType` VARCHAR(64) NULL,
  `sourceDocumentId` VARCHAR(191) NULL,
  `sourceDocumentNumber` VARCHAR(64) NULL,
  `taxableValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `ratePct` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  `tdsCgst` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `tdsSgst` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `tdsIgst` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `totalWithheld` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `isInterstate` BOOLEAN NOT NULL DEFAULT false,
  `paymentRef` VARCHAR(128) NULL,
  `paidAt` DATETIME(3) NULL,
  `paidBy` VARCHAR(191) NULL,
  `voidedAt` DATETIME(3) NULL,
  `voidedBy` VARCHAR(191) NULL,
  `voidReason` VARCHAR(500) NULL,
  `notes` VARCHAR(1000) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gst_wh_le_period_idx`(`tenantId`, `legalEntityId`, `returnPeriod`),
  INDEX `gst_wh_status_idx`(`tenantId`, `status`),
  INDEX `gst_wh_kind_idx`(`tenantId`, `kind`),
  CONSTRAINT `gst_withholding_entries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_withholding_entries_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Customer advances (GST on advance) books adjustment foundation
CREATE TABLE IF NOT EXISTS `gst_advance_entries` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `status` ENUM('RECEIVED', 'PARTIALLY_ADJUSTED', 'ADJUSTED', 'CLOSED', 'VOID') NOT NULL DEFAULT 'RECEIVED',
  `returnPeriod` VARCHAR(7) NOT NULL,
  `advanceDate` DATE NOT NULL,
  `customerName` VARCHAR(300) NOT NULL,
  `customerGstin` VARCHAR(20) NULL,
  `customerId` VARCHAR(191) NULL,
  `receiptDocumentType` VARCHAR(64) NULL,
  `receiptDocumentId` VARCHAR(191) NULL,
  `receiptDocumentNumber` VARCHAR(64) NULL,
  `advanceTaxable` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `advanceTax` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `adjustedTaxable` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `adjustedTax` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `placeOfSupply` VARCHAR(100) NULL,
  `notes` VARCHAR(1000) NULL,
  `voidedAt` DATETIME(3) NULL,
  `voidedBy` VARCHAR(191) NULL,
  `voidReason` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gst_adv_le_period_idx`(`tenantId`, `legalEntityId`, `returnPeriod`),
  INDEX `gst_adv_status_idx`(`tenantId`, `status`),
  CONSTRAINT `gst_advance_entries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_advance_entries_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gst_advance_adjustments` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `advanceEntryId` VARCHAR(191) NOT NULL,
  `salesInvoiceId` VARCHAR(191) NULL,
  `invoiceNumber` VARCHAR(64) NULL,
  `invoiceDate` DATE NULL,
  `adjustedTaxable` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `adjustedTax` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `gst_adv_adj_entry_idx`(`tenantId`, `advanceEntryId`),
  CONSTRAINT `gst_advance_adjustments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_advance_adjustments_advanceEntryId_fkey` FOREIGN KEY (`advanceEntryId`) REFERENCES `gst_advance_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
