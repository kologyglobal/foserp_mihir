-- Admin Phase 8: login activity + lockout counters
ALTER TABLE `users`
  ADD COLUMN `failedLoginCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lockedAt` DATETIME(3) NULL;

CREATE TABLE `login_activities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(255) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(64) NOT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_activities_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `login_activities_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `login_activities_email_createdAt_idx`(`email`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `login_activities`
  ADD CONSTRAINT `login_activities_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `login_activities_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'security.view', 'security', 'View login activity, sessions, locked accounts', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'security.view');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'security.manage', 'security', 'Lock/unlock accounts and revoke sessions', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'security.manage');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` IN ('security.view', 'security.manage')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );
