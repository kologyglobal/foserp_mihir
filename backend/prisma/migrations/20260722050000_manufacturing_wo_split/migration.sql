-- Wave 5 — traceable work-order split hierarchy and audit record.

ALTER TABLE `production_orders`
  ADD COLUMN `splitFromOrderId` VARCHAR(191) NULL,
  ADD COLUMN `splitSequence` INTEGER NULL,
  ADD INDEX `production_orders_tenantId_splitFromOrderId_idx` (`tenantId`, `splitFromOrderId`);

ALTER TABLE `production_orders`
  ADD CONSTRAINT `production_orders_splitFromOrderId_fkey`
    FOREIGN KEY (`splitFromOrderId`) REFERENCES `production_orders` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `production_order_splits` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `parentOrderId` VARCHAR(191) NOT NULL,
  `childOrderId` VARCHAR(191) NOT NULL,
  `splitQty` DECIMAL(18,4) NOT NULL,
  `reason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `production_order_splits_childOrderId_key` (`childOrderId`),
  INDEX `production_order_splits_tenantId_parentOrderId_idx` (`tenantId`, `parentOrderId`),
  INDEX `production_order_splits_tenantId_childOrderId_idx` (`tenantId`, `childOrderId`),
  CONSTRAINT `production_order_splits_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `production_order_splits_parentOrderId_fkey`
    FOREIGN KEY (`parentOrderId`) REFERENCES `production_orders` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `production_order_splits_childOrderId_fkey`
    FOREIGN KEY (`childOrderId`) REFERENCES `production_orders` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
