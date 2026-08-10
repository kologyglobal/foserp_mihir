-- CreateTable
CREATE TABLE `user_ui_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `prefKey` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_ui_preferences_tenantId_userId_idx`(`tenantId`, `userId`),
    UNIQUE INDEX `user_ui_preferences_tenantId_userId_prefKey_key`(`tenantId`, `userId`, `prefKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
