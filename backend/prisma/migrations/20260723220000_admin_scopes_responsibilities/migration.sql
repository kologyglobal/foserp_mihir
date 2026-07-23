-- Admin Phase 6: data scopes + responsibilities
CREATE TABLE `user_legal_entity_access` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `accessLevel` VARCHAR(32) NOT NULL DEFAULT 'TRANSACT',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_legal_entity_access_tenantId_userId_legalEntityId_key`(`tenantId`, `userId`, `legalEntityId`),
    INDEX `user_legal_entity_access_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_legal_entity_access_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_legal_entity_access`
  ADD CONSTRAINT `user_legal_entity_access_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_legal_entity_access_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_legal_entity_access_legalEntityId_fkey`
  FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `user_branch_access` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_branch_access_tenantId_userId_branchId_key`(`tenantId`, `userId`, `branchId`),
    INDEX `user_branch_access_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_branch_access_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_branch_access`
  ADD CONSTRAINT `user_branch_access_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_branch_access_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_branch_access_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `user_warehouse_access` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_warehouse_access_tenantId_userId_warehouseId_key`(`tenantId`, `userId`, `warehouseId`),
    INDEX `user_warehouse_access_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_warehouse_access_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_warehouse_access`
  ADD CONSTRAINT `user_warehouse_access_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_warehouse_access_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_warehouse_access_warehouseId_fkey`
  FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `responsibilities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `module` VARCHAR(64) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `responsibilities_tenantId_code_key`(`tenantId`, `code`),
    INDEX `responsibilities_tenantId_idx`(`tenantId`),
    INDEX `responsibilities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `responsibilities`
  ADD CONSTRAINT `responsibilities_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `user_responsibilities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `responsibilityId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NULL,
    `externalRefType` VARCHAR(64) NULL,
    `externalRefId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `user_responsibilities_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_responsibilities_tenantId_responsibilityId_idx`(`tenantId`, `responsibilityId`),
    INDEX `user_responsibilities_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_responsibilities`
  ADD CONSTRAINT `user_responsibilities_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_responsibilities_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_responsibilities_responsibilityId_fkey`
  FOREIGN KEY (`responsibilityId`) REFERENCES `responsibilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission catalog
INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'scope.view', 'scope', 'View user data scopes', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'scope.view');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'scope.manage', 'scope', 'Manage user data scopes', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'scope.manage');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'responsibility.view', 'responsibility', 'View responsibilities', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'responsibility.view');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'responsibility.create', 'responsibility', 'Create responsibilities', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'responsibility.create');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'responsibility.update', 'responsibility', 'Update responsibilities', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'responsibility.update');

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`)
SELECT UUID(), 'responsibility.delete', 'responsibility', 'Delete responsibilities', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'responsibility.delete');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` IN (
    'scope.view', 'scope.manage',
    'responsibility.view', 'responsibility.create', 'responsibility.update', 'responsibility.delete'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );

-- System responsibility catalog (tenantId NULL)
INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'PURCHASE_APPROVER', 'Purchase Approver', 'purchase', 'Named purchase approval owner (maps onto existing purchase matrix — does not replace tiers)', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'PURCHASE_APPROVER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'FINANCE_POSTER', 'Finance Poster', 'finance', 'Named finance posting / approval owner (does not replace FinanceApprovalRule)', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'FINANCE_POSTER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'CRM_OWNER', 'CRM Owner', 'crm', 'CRM pipeline / account ownership pool', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'CRM_OWNER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'STORE_KEEPER', 'Store Keeper', 'inventory', 'Warehouse / stores ownership', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'STORE_KEEPER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'PRODUCTION_PLANNER', 'Production Planner', 'manufacturing', 'Production planning ownership', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'PRODUCTION_PLANNER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'QUALITY_OWNER', 'Quality Owner', 'quality', 'Quality inspection ownership', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'QUALITY_OWNER' AND `deletedAt` IS NULL);

INSERT INTO `responsibilities` (`id`, `tenantId`, `code`, `name`, `module`, `description`, `isSystem`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), NULL, 'DISPATCH_OWNER', 'Dispatch Owner', 'dispatch', 'Dispatch / logistics ownership', true, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `responsibilities` WHERE `tenantId` IS NULL AND `code` = 'DISPATCH_OWNER' AND `deletedAt` IS NULL);
