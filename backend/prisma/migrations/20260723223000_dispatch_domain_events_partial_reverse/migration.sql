-- Phase 7C5 gap-close: posting line reversed qty + domain event outbox
-- Additive only; safe for existing dispatch_postings / reversals.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'dispatch_posting_lines'
    AND COLUMN_NAME = 'reversedQuantity'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `dispatch_posting_lines` ADD COLUMN `reversedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `quantity`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `dispatch_domain_events` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `eventType` ENUM('DISPATCH_POSTED', 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED', 'SALES_ORDER_INVOICE_READY', 'DISPATCH_REVERSED') NOT NULL,
  `status` ENUM('PENDING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `aggregateType` VARCHAR(64) NOT NULL,
  `aggregateId` VARCHAR(191) NOT NULL,
  `payloadJson` JSON NOT NULL,
  `idempotencyKey` VARCHAR(150) NOT NULL,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,
  `failureReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_domain_evt_tenant_idem_uidx`(`tenantId`, `idempotencyKey`),
  INDEX `dispatch_domain_evt_poll_idx`(`tenantId`, `status`, `availableAt`),
  INDEX `dispatch_domain_evt_type_idx`(`tenantId`, `eventType`),
  INDEX `dispatch_domain_evt_agg_idx`(`tenantId`, `aggregateType`, `aggregateId`),
  CONSTRAINT `dispatch_domain_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
