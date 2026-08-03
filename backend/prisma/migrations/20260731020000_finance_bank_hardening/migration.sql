-- Bank hardening: distributed connector sync lease + CAMT.052/.054 provisional statements.

ALTER TABLE `bank_connectors`
  ADD COLUMN `syncLockUntil` DATETIME(3) NULL,
  ADD COLUMN `syncLockToken` VARCHAR(64) NULL;

CREATE INDEX `bank_connector_sync_lock_until_idx` ON `bank_connectors` (`syncLockUntil`);

ALTER TABLE `bank_statement_import_batches`
  MODIFY COLUMN `importFormat` ENUM(
    'CSV',
    'XLSX',
    'MT940',
    'CAMT_053',
    'CAMT_052',
    'CAMT_054',
    'MANUAL',
    'AUTO_DETECT',
    'OTHER'
  ) NOT NULL DEFAULT 'OTHER';

ALTER TABLE `bank_statement_column_mapping_templates`
  MODIFY COLUMN `importFormat` ENUM(
    'CSV',
    'XLSX',
    'MT940',
    'CAMT_053',
    'CAMT_052',
    'CAMT_054',
    'MANUAL',
    'AUTO_DETECT',
    'OTHER'
  ) NOT NULL;

ALTER TABLE `bank_statements`
  MODIFY COLUMN `importFormat` ENUM(
    'CSV',
    'XLSX',
    'MT940',
    'CAMT_053',
    'CAMT_052',
    'CAMT_054',
    'MANUAL',
    'AUTO_DETECT',
    'OTHER'
  ) NULL;

ALTER TABLE `bank_statements`
  ADD COLUMN `documentType` ENUM(
    'END_OF_DAY_STATEMENT',
    'INTRADAY_REPORT',
    'DEBIT_CREDIT_NOTIFICATION'
  ) NOT NULL DEFAULT 'END_OF_DAY_STATEMENT',
  ADD COLUMN `hasOpeningBalance` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `hasClosingBalance` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `bank_statement_lines`
  ADD COLUMN `isProvisional` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `supersededByLineId` VARCHAR(191) NULL;

CREATE INDEX `bank_stmt_line_superseded_idx` ON `bank_statement_lines` (`supersededByLineId`);
CREATE INDEX `bank_stmt_line_provisional_idx` ON `bank_statement_lines` (`tenantId`, `legalEntityId`, `isProvisional`, `isExcluded`);

ALTER TABLE `bank_statement_lines`
  ADD CONSTRAINT `bank_statement_lines_supersededByLineId_fkey`
  FOREIGN KEY (`supersededByLineId`) REFERENCES `bank_statement_lines`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
