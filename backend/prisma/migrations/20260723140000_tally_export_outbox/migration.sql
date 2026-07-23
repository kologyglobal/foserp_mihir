-- Tally export Phase 1: connector config, ledger mappings, export outbox + feature flag

ALTER TABLE `finance_feature_controls`
  MODIFY COLUMN `featureKey` ENUM(
    'RECEIVABLES',
    'PAYABLES',
    'BANK_RECONCILIATION',
    'GST',
    'TDS',
    'FIXED_ASSETS',
    'MANUFACTURING_ACCOUNTING',
    'INVENTORY_ACCOUNTING',
    'BUDGETING',
    'MULTI_CURRENCY',
    'COST_CENTRES',
    'PROJECT_ACCOUNTING',
    'APPROVALS',
    'TALLY_EXPORT'
  ) NOT NULL;

CREATE TABLE `tally_connector_configs` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `status` ENUM('DISABLED', 'ENABLED', 'ERROR') NOT NULL DEFAULT 'DISABLED',
  `configJson` JSON NULL,
  `lastExportAt` DATETIME(3) NULL,
  `lastExportStatus` VARCHAR(32) NULL,
  `lastExportMessage` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `tally_connector_configs_legalEntityId_key`(`legalEntityId`),
  UNIQUE INDEX `tally_connector_configs_tenantId_code_key`(`tenantId`, `code`),
  INDEX `tally_connector_configs_tenantId_idx`(`tenantId`),
  INDEX `tally_connector_configs_tenantId_legalEntityId_status_idx`(`tenantId`, `legalEntityId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tally_ledger_mappings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `connectorId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `tallyLedgerName` VARCHAR(300) NOT NULL,
  `tallyParentGroup` VARCHAR(200) NULL,
  `tallyGuid` VARCHAR(64) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tally_ledger_mappings_connectorId_accountId_key`(`connectorId`, `accountId`),
  INDEX `tally_ledger_mappings_tenantId_idx`(`tenantId`),
  INDEX `tally_ledger_mappings_tenantId_legalEntityId_idx`(`tenantId`, `legalEntityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tally_export_outbox` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `connectorId` VARCHAR(191) NOT NULL,
  `voucherId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'RENDERING', 'READY', 'EXPORTED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `idempotencyKey` VARCHAR(200) NOT NULL,
  `payloadJson` JSON NULL,
  `xmlBody` LONGTEXT NULL,
  `xmlHash` VARCHAR(64) NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `lastAttemptAt` DATETIME(3) NULL,
  `exportedAt` DATETIME(3) NULL,
  `errorCode` VARCHAR(64) NULL,
  `errorMessage` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tally_export_outbox_tenantId_legalEntityId_idempotencyKey_key`(`tenantId`, `legalEntityId`, `idempotencyKey`),
  UNIQUE INDEX `tally_export_outbox_connectorId_voucherId_key`(`connectorId`, `voucherId`),
  INDEX `tally_export_outbox_tenantId_idx`(`tenantId`),
  INDEX `tally_export_outbox_tenantId_legalEntityId_status_createdAt_idx`(`tenantId`, `legalEntityId`, `status`, `createdAt`),
  INDEX `tally_export_outbox_voucherId_idx`(`voucherId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tally_connector_configs`
  ADD CONSTRAINT `tally_connector_configs_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_connector_configs_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tally_ledger_mappings`
  ADD CONSTRAINT `tally_ledger_mappings_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_ledger_mappings_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_ledger_mappings_connectorId_fkey`
    FOREIGN KEY (`connectorId`) REFERENCES `tally_connector_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_ledger_mappings_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tally_export_outbox`
  ADD CONSTRAINT `tally_export_outbox_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_export_outbox_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_export_outbox_connectorId_fkey`
    FOREIGN KEY (`connectorId`) REFERENCES `tally_connector_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `tally_export_outbox_voucherId_fkey`
    FOREIGN KEY (`voucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
