-- Admin Phase 5: Department master + User.departmentId
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `departments_tenantId_code_key`(`tenantId`, `code`),
    INDEX `departments_tenantId_idx`(`tenantId`),
    INDEX `departments_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `departments`
  ADD CONSTRAINT `departments_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `users` ADD COLUMN `departmentId` VARCHAR(191) NULL;

CREATE INDEX `users_departmentId_idx` ON `users`(`departmentId`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_departmentId_fkey`
  FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission catalog rows for Department CRUD
INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'department.view', 'department', 'View departments', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'department.view');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'department.create', 'department', 'Create departments', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'department.create');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'department.update', 'department', 'Update departments', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'department.update');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'department.delete', 'department', 'Delete departments', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'department.delete');

-- Grant department.* to common admin roles (idempotent)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` IN ('department.view', 'department.create', 'department.update', 'department.delete')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );
