-- Inventory costing Phase C — standard cost versions, variances, method-change audit.

CREATE TABLE `inventory_item_standard_cost_versions` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
  `remarks` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `inv_std_cost_ver_tenant_item_ver_uidx` (`tenantId`, `itemId`, `version`),
  INDEX `inv_std_cost_ver_tenant_item_status_eff_idx` (`tenantId`, `itemId`, `status`, `effectiveFrom`),
  CONSTRAINT `inv_std_cost_ver_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_std_cost_ver_item_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_cost_variances` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NULL,
  `inventoryMovementId` VARCHAR(191) NULL,
  `costEntryId` VARCHAR(191) NULL,
  `varianceType` ENUM('PURCHASE_PRICE', 'STANDARD_ISSUE', 'STANDARD_RECEIPT', 'REVALUATION', 'OTHER') NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `standardUnitCost` DECIMAL(18, 4) NOT NULL,
  `actualUnitCost` DECIMAL(18, 4) NOT NULL,
  `varianceAmount` DECIMAL(18, 2) NOT NULL,
  `postingDate` DATE NOT NULL,
  `sourceType` VARCHAR(64) NOT NULL,
  `sourceId` VARCHAR(191) NULL,
  `remarks` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `inv_cost_var_tenant_date_idx` (`tenantId`, `postingDate`),
  INDEX `inv_cost_var_tenant_item_idx` (`tenantId`, `itemId`),
  INDEX `inv_cost_var_tenant_movement_idx` (`tenantId`, `inventoryMovementId`),
  CONSTRAINT `inv_cost_var_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inv_cost_var_item_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_valuation_method_changes` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `fromMethod` ENUM('FIFO', 'MOVING_WEIGHTED_AVERAGE', 'STANDARD_COST', 'SPECIFIC_IDENTIFICATION') NOT NULL,
  `toMethod` ENUM('FIFO', 'MOVING_WEIGHTED_AVERAGE', 'STANDARD_COST', 'SPECIFIC_IDENTIFICATION') NOT NULL,
  `effectiveDate` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `openingMigrationRequired` BOOLEAN NOT NULL DEFAULT false,
  `openingMigrationCompleted` BOOLEAN NOT NULL DEFAULT false,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `inv_val_method_chg_tenant_eff_idx` (`tenantId`, `effectiveDate`),
  CONSTRAINT `inv_val_method_chg_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
