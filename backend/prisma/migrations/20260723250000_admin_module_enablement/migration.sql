-- Admin Phase 9: tenant module enablement flags
CREATE TABLE `tenant_module_flags` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(64) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_module_flags_tenantId_moduleKey_key`(`tenantId`, `moduleKey`),
    INDEX `tenant_module_flags_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tenant_module_flags`
  ADD CONSTRAINT `tenant_module_flags_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'module.view', 'module', 'View tenant module enablement', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'module.view');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'module.manage', 'module', 'Enable/disable tenant modules', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'module.manage');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` IN ('module.view', 'module.manage')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );
