-- Period Close Control Hardening: hard-block setting + checklist acks

ALTER TABLE `finance_settings`
  ADD COLUMN `periodCloseHardBlock` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `period_close_checklist_acks` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `checkKey` VARCHAR(64) NOT NULL,
  `status` ENUM('ACK', 'NA') NOT NULL,
  `note` VARCHAR(500) NULL,
  `ackedBy` VARCHAR(191) NULL,
  `ackedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `period_close_checklist_acks_periodId_checkKey_key`(`periodId`, `checkKey`),
  INDEX `period_close_checklist_acks_tenantId_idx`(`tenantId`),
  INDEX `period_close_checklist_acks_periodId_idx`(`periodId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `period_close_checklist_acks`
  ADD CONSTRAINT `period_close_checklist_acks_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `period_close_checklist_acks_periodId_fkey`
    FOREIGN KEY (`periodId`) REFERENCES `accounting_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
