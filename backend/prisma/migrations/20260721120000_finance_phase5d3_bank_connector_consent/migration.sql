-- Finance Phase 5D3 — Open Banking consent scaffold
CREATE TABLE `bank_connector_consents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `connectorId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'AUTHORIZED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `authorizationUrl` VARCHAR(1000) NULL,
    `state` VARCHAR(200) NULL,
    `redirectUri` VARCHAR(500) NULL,
    `expiresAt` DATETIME(3) NULL,
    `tokenCiphertext` TEXT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_connector_consents_tenantId_idx`(`tenantId`),
    INDEX `bank_connector_consent_connector_idx`(`tenantId`, `connectorId`),
    INDEX `bank_connector_consent_state_idx`(`tenantId`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bank_connector_consents` ADD CONSTRAINT `bank_connector_consents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bank_connector_consents` ADD CONSTRAINT `bank_connector_consents_connectorId_fkey` FOREIGN KEY (`connectorId`) REFERENCES `bank_connectors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
