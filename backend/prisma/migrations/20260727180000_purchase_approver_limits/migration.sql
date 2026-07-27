-- Per-user purchase approval INR ceilings (alongside amount-band matrix).
CREATE TABLE `purchase_approver_limits` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseSettingsId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `maxAmountInr` DECIMAL(18, 2) NOT NULL,
    `documentType` ENUM('ALL', 'PURCHASE_REQUISITION', 'PURCHASE_ORDER') NOT NULL DEFAULT 'ALL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_approver_limits_settings_user_doc_uidx`(`purchaseSettingsId`, `userId`, `documentType`),
    INDEX `purchase_approver_limits_tenantId_idx`(`tenantId`),
    INDEX `purchase_approver_limits_tenantId_userId_idx`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_purchaseSettingsId_fkey` FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_approver_limits` ADD CONSTRAINT `purchase_approver_limits_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
