-- Manufacturing Wave 2: labour rate cards and activity-based overhead pools.
ALTER TABLE `manufacturing_costing_policies`
  MODIFY COLUMN `labourRateSource`
  ENUM('WORK_CENTRE_RATE', 'TENANT_DEFAULT', 'LABOUR_RATE_CARD')
  NOT NULL DEFAULT 'WORK_CENTRE_RATE',
  MODIFY COLUMN `overheadMethod`
  ENUM('NONE', 'PER_LABOUR_HOUR', 'PER_MACHINE_HOUR', 'PER_GOOD_UNIT', 'PERCENT_OF_MATERIAL_COST', 'ACTIVITY_BASED')
  NOT NULL DEFAULT 'NONE';

CREATE TABLE `labour_rate_cards` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `workCentreId` VARCHAR(191) NULL,
  `roleCode` VARCHAR(64) NULL,
  `operatorUserId` VARCHAR(191) NULL,
  `ratePerHour` DECIMAL(18,2) NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `labour_rate_cards_tenantId_code_key`(`tenantId`, `code`),
  INDEX `labour_rate_cards_tenantId_workCentreId_effectiveFrom_idx`(`tenantId`, `workCentreId`, `effectiveFrom`),
  PRIMARY KEY (`id`),
  CONSTRAINT `labour_rate_cards_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `labour_rate_cards_workCentreId_fkey` FOREIGN KEY (`workCentreId`) REFERENCES `manufacturing_work_centres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `overhead_cost_pools` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `plantCode` VARCHAR(32) NULL,
  `driverType` VARCHAR(32) NOT NULL,
  `periodAmount` DECIMAL(18,2) NOT NULL,
  `periodStart` DATE NOT NULL,
  `periodEnd` DATE NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `overhead_cost_pools_tenantId_code_periodStart_key`(`tenantId`, `code`, `periodStart`),
  INDEX `overhead_cost_pools_tenantId_plantCode_periodStart_periodEnd_idx`(`tenantId`, `plantCode`, `periodStart`, `periodEnd`),
  PRIMARY KEY (`id`),
  CONSTRAINT `overhead_cost_pools_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
