-- Inventory accounting events (flag-gated GL) + INVENTORY_ACCOUNTING finance feature key.
-- Additive only. Mirrors production_accounting_events; short index names for MySQL.

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
    'APPROVALS'
  ) NOT NULL;

CREATE TABLE `inventory_accounting_events` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `eventType` ENUM(
    'GRN_INWARD',
    'GRN_REVERSAL',
    'PURCHASE_RETURN',
    'STOCK_ADJUSTMENT',
    'STOCK_ADJUSTMENT_REVERSAL',
    'STOCK_COUNT_ADJUSTMENT',
    'STOCK_COUNT_REVERSAL',
    'FG_DISPATCH',
    'FG_DISPATCH_REVERSAL'
  ) NOT NULL,
  `status` ENUM(
    'RECORDED',
    'POSTED',
    'SKIPPED_ZERO',
    'SKIPPED_FLAG_OFF',
    'SKIPPED_NO_LEGAL_ENTITY',
    'FAILED',
    'REVERSED'
  ) NOT NULL DEFAULT 'RECORDED',
  `movementId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(150) NOT NULL,
  `sourceDocumentType` VARCHAR(64) NOT NULL,
  `sourceDocumentId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `payloadJson` JSON NULL,
  `voucherId` VARCHAR(191) NULL,
  `postingEventId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `failureReason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `inv_acct_evt_tenant_idem_key` (`tenantId`, `idempotencyKey`),
  INDEX `inv_acct_evt_tenant_idx` (`tenantId`),
  INDEX `inv_acct_evt_tenant_type_idx` (`tenantId`, `eventType`),
  INDEX `inv_acct_evt_tenant_status_idx` (`tenantId`, `status`),
  INDEX `inv_acct_evt_tenant_mov_idx` (`tenantId`, `movementId`),
  INDEX `inv_acct_evt_tenant_le_idx` (`tenantId`, `legalEntityId`),
  CONSTRAINT `inv_acct_evt_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_acct_evt_le_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
