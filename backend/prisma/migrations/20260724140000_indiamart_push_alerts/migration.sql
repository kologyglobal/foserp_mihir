-- IndiaMART Phase 5: Push webhook, alerts, richer dashboard support

ALTER TABLE `indiamart_connections`
  ADD COLUMN `pushWebhookEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `pushWebhookTokenHash` VARCHAR(128) NULL,
  ADD COLUMN `pushWebhookTokenPrefix` VARCHAR(12) NULL;

CREATE UNIQUE INDEX `indiamart_connections_pushWebhookTokenHash_key`
  ON `indiamart_connections`(`pushWebhookTokenHash`);

ALTER TABLE `indiamart_sync_runs`
  MODIFY COLUMN `triggerType` ENUM('MANUAL', 'SCHEDULED', 'RETRY', 'INITIAL_IMPORT', 'PUSH') NOT NULL;

CREATE TABLE `indiamart_alerts` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `connectionId` VARCHAR(191) NULL,
  `enquiryId` VARCHAR(191) NULL,
  `syncRunId` VARCHAR(191) NULL,
  `alertType` ENUM(
    'NEW_ENQUIRY_ASSIGNED',
    'HIGH_VALUE_ENQUIRY',
    'SLA_DUE_SOON',
    'SLA_OVERDUE',
    'SYNC_FAILED',
    'CREDENTIALS_EXPIRED',
    'DUPLICATE_NEEDS_REVIEW'
  ) NOT NULL,
  `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `href` VARCHAR(500) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `readAt` DATETIME(3) NULL,
  `readById` VARCHAR(191) NULL,
  `dedupeKey` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `indiamart_alerts_tenantId_dedupeKey_key`(`tenantId`, `dedupeKey`),
  INDEX `indiamart_alerts_tenantId_isRead_createdAt_idx`(`tenantId`, `isRead`, `createdAt`),
  INDEX `indiamart_alerts_tenantId_alertType_idx`(`tenantId`, `alertType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `indiamart_alerts`
  ADD CONSTRAINT `indiamart_alerts_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_alerts`
  ADD CONSTRAINT `indiamart_alerts_connectionId_fkey`
  FOREIGN KEY (`connectionId`) REFERENCES `indiamart_connections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
