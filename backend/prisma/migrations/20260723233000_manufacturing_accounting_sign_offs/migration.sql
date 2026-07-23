-- Additive Manufacturing Accounting sign-off history (enablement gate).
-- Does not alter ProductionAccountingEvent / GL / cost snapshots.

CREATE TABLE `manufacturing_accounting_sign_offs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `signOffType` ENUM('INVENTORY_RECONCILIATION', 'FINANCE_PILOT_APPROVAL') NOT NULL,
    `status` ENUM('ACTIVE', 'SUPERSEDED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `confirmedById` VARCHAR(191) NOT NULL,
    `confirmedAt` DATETIME(3) NOT NULL,
    `remarks` TEXT NULL,
    `scopeJson` JSON NULL,
    `readinessSnapshotJson` JSON NULL,
    `idempotencyKey` VARCHAR(150) NULL,
    `supersedesId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mfg_acct_signoff_tenant_idem_key`(`tenantId`, `idempotencyKey`),
    INDEX `mfg_acct_signoff_tenant_idx`(`tenantId`),
    INDEX `mfg_acct_signoff_le_idx`(`legalEntityId`),
    INDEX `mfg_acct_signoff_type_idx`(`signOffType`),
    INDEX `mfg_acct_signoff_status_idx`(`status`),
    INDEX `mfg_acct_signoff_confirmed_idx`(`confirmedAt`),
    INDEX `mfg_acct_signoff_active_idx`(`tenantId`, `legalEntityId`, `signOffType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `manufacturing_accounting_sign_offs`
  ADD CONSTRAINT `manufacturing_accounting_sign_offs_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `manufacturing_accounting_sign_offs_legalEntityId_fkey`
    FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `manufacturing_accounting_sign_offs_supersedesId_fkey`
    FOREIGN KEY (`supersedesId`) REFERENCES `manufacturing_accounting_sign_offs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
