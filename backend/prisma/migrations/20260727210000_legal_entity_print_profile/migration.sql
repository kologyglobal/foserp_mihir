-- AlterTable: Legal Entity letterhead / print profile (email, phone, website, bank details).
-- Used by Proforma Invoice, Sales Order, and Tax Invoice print/preview documents.
-- Public by design (shared with customers for remittance) — distinct from TreasuryBankProfile,
-- which intentionally masks account numbers for internal treasury/reconciliation security.
ALTER TABLE `legal_entities` ADD COLUMN `email` VARCHAR(255) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `phone` VARCHAR(30) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `website` VARCHAR(255) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `bankAccountName` VARCHAR(200) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `bankName` VARCHAR(200) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `bankAccountNumber` VARCHAR(40) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `bankIfscCode` VARCHAR(20) NULL;
ALTER TABLE `legal_entities` ADD COLUMN `bankBranch` VARCHAR(200) NULL;
