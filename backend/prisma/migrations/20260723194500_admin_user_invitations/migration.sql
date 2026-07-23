-- Admin Panel Phase 4: hashed single-use user invitations
CREATE TABLE `user_invitations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `invitedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_invitations_tenantId_idx`(`tenantId`),
    INDEX `user_invitations_userId_idx`(`userId`),
    INDEX `user_invitations_tokenHash_idx`(`tokenHash`),
    INDEX `user_invitations_tenantId_email_idx`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_invitations`
  ADD CONSTRAINT `user_invitations_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_invitations`
  ADD CONSTRAINT `user_invitations_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
