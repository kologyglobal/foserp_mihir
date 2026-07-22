-- Manufacturing Phase 6B — ProductionAccountingEvent (flag-gated GL).
-- Additive only. Short index names for MySQL.

CREATE TABLE `production_accounting_events` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `eventType` ENUM(
    'MATERIAL_RESERVED',
    'MATERIAL_ISSUED',
    'MATERIAL_RETURNED',
    'MATERIAL_CONSUMED',
    'WIP_MOVED',
    'SEMI_FINISHED_RECEIVED',
    'PRODUCTION_COMPLETED',
    'FINISHED_GOODS_RECEIVED',
    'SCRAP_RECORDED',
    'PRODUCTION_ORDER_CLOSED'
  ) NOT NULL,
  `status` ENUM('RECORDED', 'POSTED', 'SKIPPED_ZERO', 'SKIPPED_FLAG_OFF') NOT NULL DEFAULT 'RECORDED',
  `productionOrderId` VARCHAR(191) NULL,
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
  UNIQUE INDEX `mfg_acct_evt_tenant_idem_key` (`tenantId`, `idempotencyKey`),
  INDEX `mfg_acct_evt_tenant_idx` (`tenantId`),
  INDEX `mfg_acct_evt_tenant_wo_idx` (`tenantId`, `productionOrderId`),
  INDEX `mfg_acct_evt_tenant_type_idx` (`tenantId`, `eventType`),
  INDEX `mfg_acct_evt_tenant_status_idx` (`tenantId`, `status`),
  INDEX `mfg_acct_evt_tenant_le_idx` (`tenantId`, `legalEntityId`),
  CONSTRAINT `mfg_acct_evt_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_acct_evt_le_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_acct_evt_wo_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
