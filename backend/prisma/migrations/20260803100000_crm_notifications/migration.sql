-- CRM / app notifications (tenant-scoped)

CREATE TABLE `app_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NOT NULL,
    `category` ENUM('ASSIGNMENT', 'FOLLOW_UP', 'ACTIVITY', 'MEETING', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER', 'APPROVAL', 'PROSPECT_REPLY', 'DATA_QUALITY', 'RISK', 'INTEGRATION') NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `priority` ENUM('CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'POSITIVE') NOT NULL DEFAULT 'NORMAL',
    `title` VARCHAR(300) NOT NULL,
    `message` TEXT NOT NULL,
    `entityType` VARCHAR(64) NULL,
    `entityId` VARCHAR(191) NULL,
    `entityCode` VARCHAR(64) NULL,
    `entityName` VARCHAR(300) NULL,
    `actionUrl` VARCHAR(500) NULL,
    `primaryAction` VARCHAR(64) NULL,
    `secondaryAction` VARCHAR(64) NULL,
    `status` ENUM('UNREAD', 'READ', 'RESOLVED', 'SNOOZED', 'DISMISSED') NOT NULL DEFAULT 'UNREAD',
    `readAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `snoozedUntil` DATETIME(3) NULL,
    `sourceEventId` VARCHAR(120) NULL,
    `deduplicationKey` VARCHAR(255) NULL,
    `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `app_notifications_tenantId_recipientUserId_status_idx`(`tenantId`, `recipientUserId`, `status`),
    INDEX `app_notifications_tenantId_recipientUserId_createdAt_idx`(`tenantId`, `recipientUserId`, `createdAt`),
    INDEX `app_notifications_tenantId_priority_createdAt_idx`(`tenantId`, `priority`, `createdAt`),
    INDEX `app_notifications_tenantId_entityType_entityId_idx`(`tenantId`, `entityType`, `entityId`),
    INDEX `app_notifications_tenantId_deduplicationKey_idx`(`tenantId`, `deduplicationKey`),
    INDEX `app_notifications_tenantId_type_status_idx`(`tenantId`, `type`, `status`),
    INDEX `app_notifications_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `notificationType` VARCHAR(64) NOT NULL,
    `inAppEnabled` BOOLEAN NOT NULL DEFAULT true,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mobilePushEnabled` BOOLEAN NOT NULL DEFAULT false,
    `whatsappEnabled` BOOLEAN NOT NULL DEFAULT false,
    `dailyDigestEnabled` BOOLEAN NOT NULL DEFAULT false,
    `reminderMinutesBefore` INTEGER NULL,
    `escalationEnabled` BOOLEAN NOT NULL DEFAULT true,
    `muteUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_preferences_tenantId_userId_notificationType_key`(`tenantId`, `userId`, `notificationType`),
    INDEX `notification_preferences_tenantId_userId_idx`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification_tenant_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `leadContactSlaHours` INTEGER NOT NULL DEFAULT 2,
    `leadContactEscalateHours` INTEGER NOT NULL DEFAULT 8,
    `leadContactCriticalHours` INTEGER NOT NULL DEFAULT 24,
    `opportunityInactiveDays` INTEGER NOT NULL DEFAULT 7,
    `opportunityInactiveHighValueDays` INTEGER NOT NULL DEFAULT 3,
    `opportunityStuckDays` INTEGER NOT NULL DEFAULT 14,
    `highValueDealThreshold` DECIMAL(18, 2) NOT NULL DEFAULT 500000,
    `followUpEscalateHours` INTEGER NOT NULL DEFAULT 24,
    `followUpCriticalHours` INTEGER NOT NULL DEFAULT 72,
    `quotationExpiringDays` INTEGER NOT NULL DEFAULT 3,
    `acceptedQuoteAwaitingSoHours` INTEGER NOT NULL DEFAULT 24,
    `businessDayStartHour` INTEGER NOT NULL DEFAULT 9,
    `businessDayEndHour` INTEGER NOT NULL DEFAULT 18,
    `timezoneOverride` VARCHAR(64) NULL,
    `dailyDigestHourLocal` INTEGER NOT NULL DEFAULT 8,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_tenant_settings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `app_notifications`
  ADD CONSTRAINT `app_notifications_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `app_notifications`
  ADD CONSTRAINT `app_notifications_recipientUserId_fkey`
  FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notification_preferences`
  ADD CONSTRAINT `notification_preferences_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notification_preferences`
  ADD CONSTRAINT `notification_preferences_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notification_tenant_settings`
  ADD CONSTRAINT `notification_tenant_settings_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
