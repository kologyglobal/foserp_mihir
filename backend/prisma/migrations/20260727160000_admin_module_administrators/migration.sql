-- Admin A3–A9: Module Administrators designation register
CREATE TABLE `module_administrators` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(64) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `module_administrators_tenantId_userId_moduleKey_key`(`tenantId`, `userId`, `moduleKey`),
    INDEX `module_administrators_tenantId_moduleKey_idx`(`tenantId`, `moduleKey`),
    INDEX `module_administrators_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `module_administrators_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `module_administrators`
  ADD CONSTRAINT `module_administrators_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `module_administrators`
  ADD CONSTRAINT `module_administrators_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
