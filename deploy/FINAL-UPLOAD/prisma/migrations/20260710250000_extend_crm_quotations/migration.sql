-- AlterTable
ALTER TABLE `crm_quotations`
    ADD COLUMN `qty` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    ADD COLUMN `revisionNo` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `locked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `terms` TEXT NULL,
    ADD COLUMN `paymentTerms` VARCHAR(500) NULL,
    ADD COLUMN `deliveryTerms` VARCHAR(500) NULL,
    ADD COLUMN `locationId` VARCHAR(191) NULL,
    ADD COLUMN `pricing` JSON NOT NULL DEFAULT ('{}'),
    ADD COLUMN `changeHistory` JSON NOT NULL DEFAULT ('[]'),
    ADD COLUMN `customerApproval` VARCHAR(32) NOT NULL DEFAULT 'pending',
    ADD COLUMN `customerApprovalAt` DATETIME(3) NULL,
    ADD COLUMN `customerApprovalBy` VARCHAR(191) NULL,
    ADD COLUMN `customerRejectionReason` TEXT NULL,
    ADD COLUMN `salesOrderId` VARCHAR(191) NULL,
    ADD COLUMN `salesOrderNo` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `crm_quotation_documents`
    ADD COLUMN `sections` JSON NOT NULL DEFAULT ('[]'),
    ADD COLUMN `priceLines` JSON NOT NULL DEFAULT ('[]'),
    ADD COLUMN `commercialNotes` TEXT NULL,
    ADD COLUMN `technicalNotes` TEXT NULL,
    ADD COLUMN `installationAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `customCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `locationId` VARCHAR(191) NULL,
    ADD COLUMN `salesOrderId` VARCHAR(191) NULL,
    ADD COLUMN `salesOrderNo` VARCHAR(64) NULL;

-- AlterEnum (MySQL: CodeSeriesEntity is stored as VARCHAR in code_series)
-- QUOTATION added to application enum only; no DB enum column change required.
