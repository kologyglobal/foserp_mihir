-- Inventory tenant setup / policy persistence (idempotent)

CREATE TABLE IF NOT EXISTS `inventory_settings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `settings` JSON NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdById` VARCHAR(36) NULL,
  `updatedById` VARCHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_settings_tenantId_key`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventory_settings'
    AND CONSTRAINT_NAME = 'inventory_settings_tenantId_fkey'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE `inventory_settings` ADD CONSTRAINT `inventory_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
