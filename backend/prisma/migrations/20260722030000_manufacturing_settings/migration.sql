-- Manufacturing Settings — tenant-level dual-mode configuration and enforcement.

CREATE TABLE `manufacturing_settings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `payloadJson` JSON NOT NULL,
  `allowOverproduction` BOOLEAN NOT NULL DEFAULT true,
  `overproductionTolerancePercent` DECIMAL(9,4) NOT NULL DEFAULT 5,
  `allowCloseWithoutQc` BOOLEAN NOT NULL DEFAULT false,
  `requireReservation` BOOLEAN NOT NULL DEFAULT false,
  `allowPartialProduction` BOOLEAN NOT NULL DEFAULT true,
  `allowProductionWithoutFullMaterial` BOOLEAN NOT NULL DEFAULT true,
  `autoPostAbsorption` BOOLEAN NOT NULL DEFAULT false,
  `oeeEnabled` BOOLEAN NOT NULL DEFAULT false,
  `shiftMinutesPerDay` INTEGER NOT NULL DEFAULT 480,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `manufacturing_settings_tenantId_key` (`tenantId`),
  CONSTRAINT `manufacturing_settings_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
