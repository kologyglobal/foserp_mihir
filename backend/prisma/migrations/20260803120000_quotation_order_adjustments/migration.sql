-- Quotation order adjustments: calc type / value / tax flags for freight, installation, other + order discount

ALTER TABLE `crm_quotation_documents`
  ADD COLUMN `orderDiscountCalcType` VARCHAR(16) NOT NULL DEFAULT 'FLAT',
  ADD COLUMN `orderDiscountValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `orderDiscountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `freightCalcType` VARCHAR(16) NOT NULL DEFAULT 'FLAT',
  ADD COLUMN `freightValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `freightIsTaxable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `freightTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `freightTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `installationCalcType` VARCHAR(16) NOT NULL DEFAULT 'FLAT',
  ADD COLUMN `installationValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `installationIsTaxable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `installationTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `installationTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `customChargesCalcType` VARCHAR(16) NOT NULL DEFAULT 'FLAT',
  ADD COLUMN `customChargesValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `customChargesIsTaxable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `customChargesTaxRate` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `customChargesTaxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- Backfill: treat existing flat charge amounts as FLAT values
UPDATE `crm_quotation_documents`
SET
  `freightValue` = `freightAmount`,
  `installationValue` = `installationAmount`,
  `customChargesValue` = `customCharges`
WHERE `deletedAt` IS NULL;
