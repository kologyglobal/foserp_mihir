/* =========================================================
   LIVE DEPLOY — Part B3 schema
   File: live-deploy-po-versioning.sql
   Migration: 20260728180000_po_versioning
   Order: 4th. Idempotent. No FKs (Hostinger-safe).
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'po_versioning' AS script;
SET @db := DATABASE();

/* purchase_orders.revisionNo */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='revisionNo'),
  'SELECT ''OK purchase_orders.revisionNo'' AS msg',
  'ALTER TABLE `purchase_orders` ADD COLUMN `revisionNo` INT NOT NULL DEFAULT 0'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* purchase_settings.requireApprovalOnPoRevision */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_settings' AND COLUMN_NAME='requireApprovalOnPoRevision'),
  'SELECT ''OK purchase_settings.requireApprovalOnPoRevision'' AS msg',
  'ALTER TABLE `purchase_settings` ADD COLUMN `requireApprovalOnPoRevision` BOOLEAN NOT NULL DEFAULT true'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* purchase_order_revisions — indexes only, no FKs */
CREATE TABLE IF NOT EXISTS `purchase_order_revisions` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `purchaseOrderId` VARCHAR(191) NOT NULL,
  `revisionNo` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `statusBefore` VARCHAR(40) NOT NULL,
  `statusAfter` VARCHAR(40) NOT NULL,
  `revisedById` VARCHAR(36) NULL,
  `revisedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `headerSnapshot` JSON NOT NULL,
  `linesSnapshot` JSON NOT NULL,
  `changes` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `purchase_order_revisions_tenantId_purchaseOrderId_revisionNo_key` (`tenantId`, `purchaseOrderId`, `revisionNo`),
  INDEX `purchase_order_revisions_tenantId_idx` (`tenantId`),
  INDEX `purchase_order_revisions_tenantId_purchaseOrderId_idx` (`tenantId`, `purchaseOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='revisionNo') AS po_revision_no,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_settings' AND COLUMN_NAME='requireApprovalOnPoRevision') AS setup_flag,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='purchase_order_revisions') AS revisions_table;
