-- Finance Fixed Assets Phase FA2 — disposal document workflow (full exit SALE/SCRAP/WRITE_OFF).
-- Replaces Phase 3 stub `fixed_asset_disposals` (POSTED/CANCELLED only) with full document table.
-- `fixed_asset_transfers` already created by 20260720290000 — left unchanged.
-- Additive for number-series / approval enums and `fixed_assets.disposalDocumentId`.

-- Extend finance document numbering enum
ALTER TABLE `finance_number_series`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'RECEIPT',
    'PAYMENT',
    'CONTRA',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'OPENING_BALANCE',
    'REVERSAL',
    'SALES_INVOICE',
    'CUSTOMER_RECEIPT',
    'CUSTOMER_CREDIT_NOTE',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_DEBIT_NOTE',
    'VENDOR_CREDIT_ADJUSTMENT',
    'BANK_RECONCILIATION_MATCH',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE',
    'TREASURY_ADJUSTMENT',
    'FIXED_ASSET',
    'FA_DEPRECIATION_RUN',
    'FIXED_ASSET_DISPOSAL'
  ) NOT NULL;

-- Extend finance approval document type enum
ALTER TABLE `finance_approval_requests`
  MODIFY `documentType` ENUM(
    'JOURNAL',
    'PAYMENT',
    'RECEIPT',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'PERIOD_REOPEN',
    'VENDOR_INVOICE',
    'VENDOR_PAYMENT',
    'VENDOR_ADJUSTMENT',
    'TREASURY_TRANSFER',
    'TREASURY_CHEQUE',
    'TREASURY_ADJUSTMENT',
    'FIXED_ASSET_DISPOSAL'
  ) NOT NULL;

-- Soft pointer from asset register to current FA2 disposal document
ALTER TABLE `fixed_assets`
  ADD COLUMN `disposalDocumentId` VARCHAR(191) NULL;

-- Replace Phase 3 stub disposal table with full FA2 document schema
DROP TABLE IF EXISTS `fixed_asset_disposals`;

CREATE TABLE `fixed_asset_disposals` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NOT NULL,

    `disposalNumber` VARCHAR(64) NULL,
    `draftReference` VARCHAR(64) NOT NULL,

    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `disposalType` ENUM('SALE', 'SCRAP', 'WRITE_OFF') NOT NULL,
    `isPartial` BOOLEAN NOT NULL DEFAULT false,

    `disposalDate` DATE NOT NULL,
    `postingDate` DATE NULL,

    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',

    `proceeds` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    `buyerName` VARCHAR(200) NULL,
    `reason` VARCHAR(1000) NOT NULL,

    `preDisposalAssetStatus` ENUM('DRAFT', 'PENDING_CAPITALIZATION', 'ACTIVE', 'IDLE', 'FULLY_DEPRECIATED', 'DISPOSED', 'CANCELLED') NULL,

    `acquisitionCostSnapshot` DECIMAL(18, 4) NULL,
    `accumulatedDepreciationSnapshot` DECIMAL(18, 4) NULL,
    `netBookValueSnapshot` DECIMAL(18, 4) NULL,
    `disposedCost` DECIMAL(18, 4) NULL,
    `disposedAccumDep` DECIMAL(18, 4) NULL,
    `disposedNbv` DECIMAL(18, 4) NULL,
    `gainLoss` DECIMAL(18, 4) NULL,

    `proceedsTreasuryAccountId` VARCHAR(191) NULL,
    `proceedsAccountId` VARCHAR(191) NULL,

    `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
    `placeOfSupply` VARCHAR(8) NULL,
    `partyGstin` VARCHAR(15) NULL,
    `taxableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cessAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalProceeds` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `approvalRequestId` VARCHAR(191) NULL,

    `postingEventId` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,

    `reversalPostingEventId` VARCHAR(191) NULL,
    `reversalVoucherId` VARCHAR(191) NULL,

    `uniquenessKey` VARCHAR(300) NULL,

    `validationSnapshot` JSON NULL,
    `accountingPreviewSnapshot` JSON NULL,

    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,

    `readyAt` DATETIME(3) NULL,
    `readyById` VARCHAR(191) NULL,

    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,

    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(500) NULL,

    `reversedAt` DATETIME(3) NULL,
    `reversedById` VARCHAR(191) NULL,
    `reversalDate` DATE NULL,
    `reversalReason` VARCHAR(500) NULL,

    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `fa_disposal_le_number_key` ON `fixed_asset_disposals`(`tenantId`, `legalEntityId`, `disposalNumber`);
CREATE UNIQUE INDEX `fixed_asset_disposals_postingEventId_key` ON `fixed_asset_disposals`(`postingEventId`);
CREATE UNIQUE INDEX `fixed_asset_disposals_reversalPostingEventId_key` ON `fixed_asset_disposals`(`reversalPostingEventId`);
CREATE UNIQUE INDEX `fixed_asset_disposals_uniquenessKey_key` ON `fixed_asset_disposals`(`uniquenessKey`);
CREATE INDEX `fixed_asset_disposals_tenantId_idx` ON `fixed_asset_disposals`(`tenantId`);
CREATE INDEX `fa_disposal_le_status_idx` ON `fixed_asset_disposals`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `fixed_asset_disposals_assetId_idx` ON `fixed_asset_disposals`(`assetId`);
CREATE INDEX `fixed_asset_disposals_draftReference_idx` ON `fixed_asset_disposals`(`draftReference`);

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_legalEntityId_fkey`
  FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_assetId_fkey`
  FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_proceedsTreasuryAccountId_fkey`
  FOREIGN KEY (`proceedsTreasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_postingEventId_fkey`
  FOREIGN KEY (`postingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `fixed_asset_disposals`
  ADD CONSTRAINT `fixed_asset_disposals_reversalPostingEventId_fkey`
  FOREIGN KEY (`reversalPostingEventId`) REFERENCES `posting_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
