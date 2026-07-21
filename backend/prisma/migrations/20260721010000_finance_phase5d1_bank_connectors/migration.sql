-- Finance Phase 5D1 — Bank connector scaffold (config only; no live bank APIs).

CREATE TABLE `bank_connectors` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `treasuryAccountId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `provider` ENUM('MANUAL_FILE', 'GENERIC_REST', 'MT940_SFTP', 'CAMT_SFTP', 'OPEN_BANKING') NOT NULL,
    `status` ENUM('DISABLED', 'ENABLED', 'ERROR') NOT NULL DEFAULT 'DISABLED',
    `baseUrl` VARCHAR(500) NULL,
    `scheduleCron` VARCHAR(64) NULL,
    `configJson` JSON NULL,
    `lastTestAt` DATETIME(3) NULL,
    `lastTestStatus` ENUM('NOT_CONFIGURED', 'NOT_IMPLEMENTED', 'PROVIDER_DISABLED', 'OK', 'ERROR') NULL,
    `lastTestMessage` VARCHAR(500) NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `lastSyncStatus` ENUM('NOT_CONFIGURED', 'NOT_IMPLEMENTED', 'PROVIDER_DISABLED', 'OK', 'ERROR') NULL,
    `lastSyncMessage` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `bank_connector_tenant_code_key` ON `bank_connectors`(`tenantId`, `code`);
CREATE INDEX `bank_connectors_tenantId_idx` ON `bank_connectors`(`tenantId`);
CREATE INDEX `bank_connector_le_status_idx` ON `bank_connectors`(`tenantId`, `legalEntityId`, `status`);
CREATE INDEX `bank_connector_acct_idx` ON `bank_connectors`(`tenantId`, `treasuryAccountId`);

ALTER TABLE `bank_connectors` ADD CONSTRAINT `bank_connectors_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_connectors` ADD CONSTRAINT `bank_connectors_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_connectors` ADD CONSTRAINT `bank_connectors_treasuryAccountId_fkey` FOREIGN KEY (`treasuryAccountId`) REFERENCES `treasury_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
