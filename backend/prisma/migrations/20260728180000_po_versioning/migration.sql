-- Purchase Order versioning: revisionNo + immutable revision snapshots + setup flag

ALTER TABLE `purchase_orders`
  ADD COLUMN `revisionNo` INT NOT NULL DEFAULT 0;

ALTER TABLE `purchase_settings`
  ADD COLUMN `requireApprovalOnPoRevision` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `purchase_order_revisions` (
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
  UNIQUE INDEX `purchase_order_revisions_tenantId_purchaseOrderId_revisionNo_key`(`tenantId`, `purchaseOrderId`, `revisionNo`),
  INDEX `purchase_order_revisions_tenantId_idx`(`tenantId`),
  INDEX `purchase_order_revisions_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_order_revisions`
  ADD CONSTRAINT `purchase_order_revisions_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_order_revisions`
  ADD CONSTRAINT `purchase_order_revisions_purchaseOrderId_fkey`
  FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
