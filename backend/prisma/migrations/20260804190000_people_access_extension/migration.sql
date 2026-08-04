-- People & Access extension: data access level, overrides, approval authority
ALTER TABLE `users`
  ADD COLUMN `dataAccessLevel` ENUM('OWN', 'TEAM', 'DEPARTMENT', 'BRANCH', 'LEGAL_ENTITY', 'WAREHOUSE', 'ALL') NOT NULL DEFAULT 'ALL';

CREATE TABLE `user_permission_overrides` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `permissionId` VARCHAR(191) NOT NULL,
  `effect` ENUM('ALLOW', 'DENY') NOT NULL,
  `reason` VARCHAR(500) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_permission_overrides_tenantId_userId_permissionId_key`(`tenantId`, `userId`, `permissionId`),
  INDEX `user_permission_overrides_tenantId_userId_idx`(`tenantId`, `userId`),
  INDEX `user_permission_overrides_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  CONSTRAINT `user_permission_overrides_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_permission_overrides_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_permission_overrides_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `approval_authority_rules` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `documentType` VARCHAR(64) NOT NULL,
  `amountFrom` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `amountTo` DECIMAL(18, 2) NULL,
  `roleId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `branchId` VARCHAR(191) NULL,
  `legalEntityId` VARCHAR(191) NULL,
  `selfApprovalAllowed` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `notes` VARCHAR(500) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `approval_authority_rules_tenantId_documentType_idx`(`tenantId`, `documentType`),
  INDEX `approval_authority_rules_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  CONSTRAINT `approval_authority_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `approval_authority_rules_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `approval_authority_rules_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
