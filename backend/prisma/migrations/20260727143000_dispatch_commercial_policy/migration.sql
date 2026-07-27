-- Dispatch commercial policy (O2C) — tenant settings. Additive; defaults match prior code behaviour.
CREATE TABLE IF NOT EXISTS `dispatch_settings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `allowPartialDispatch` BOOLEAN NOT NULL DEFAULT true,
  `allowMultipleDispatches` BOOLEAN NOT NULL DEFAULT true,
  `allowOverDispatch` BOOLEAN NOT NULL DEFAULT false,
  `invoiceMode` ENUM('ONE_PER_DISPATCH', 'CONSOLIDATED', 'MANUAL_ONLY') NOT NULL DEFAULT 'ONE_PER_DISPATCH',
  `requirePodBeforeInvoice` BOOLEAN NOT NULL DEFAULT false,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `dispatch_settings_tenantId_key`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dispatch_settings`
  ADD CONSTRAINT `dispatch_settings_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
