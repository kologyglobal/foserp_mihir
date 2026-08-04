-- Mobile push foundation (M3.1): Expo device token registration only.
-- Full push delivery engine is intentionally out of scope.

CREATE TABLE `mobile_device_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expoPushToken` VARCHAR(512) NOT NULL,
    `deviceId` VARCHAR(128) NULL,
    `platform` VARCHAR(32) NOT NULL,
    `appVersion` VARCHAR(32) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    `revokedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mobile_device_tokens_tenantId_expoPushToken_key`(`tenantId`, `expoPushToken`),
    INDEX `mobile_device_tokens_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `mobile_device_tokens_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `mobile_device_tokens`
  ADD CONSTRAINT `mobile_device_tokens_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mobile_device_tokens`
  ADD CONSTRAINT `mobile_device_tokens_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
