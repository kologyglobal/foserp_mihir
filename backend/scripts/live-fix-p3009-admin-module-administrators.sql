/* =========================================================
   LIVE FIX — Prisma P3009 migration blocker
   Failed: 20260727160000_admin_module_administrators
   
   Run in phpMyAdmin AFTER selecting your live DB (u233611619_foserp).
   Then redeploy — migrate deploy should continue past this migration.
   ========================================================= */

SELECT DATABASE() AS current_db;
SET @db := DATABASE();

/* ── 1) Ensure module_administrators exists (idempotent) ── */
SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='module_administrators'),
  'SELECT ''OK module_administrators'' AS step1',
  'CREATE TABLE `module_administrators` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(64) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    UNIQUE INDEX `module_administrators_tenantId_userId_moduleKey_key`(`tenantId`, `userId`, `moduleKey`),
    INDEX `module_administrators_tenantId_moduleKey_idx`(`tenantId`, `moduleKey`),
    INDEX `module_administrators_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `module_administrators_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='module_administrators'
      AND CONSTRAINT_NAME='module_administrators_tenantId_fkey'
  ),
  'SELECT 1',
  'ALTER TABLE `module_administrators` ADD CONSTRAINT `module_administrators_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA=@db AND TABLE_NAME='module_administrators'
      AND CONSTRAINT_NAME='module_administrators_userId_fkey'
  ),
  'SELECT 1',
  'ALTER TABLE `module_administrators` ADD CONSTRAINT `module_administrators_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ── 2) Mark failed migration as successfully applied (clears P3009) ── */
UPDATE `_prisma_migrations`
SET
  `finished_at` = COALESCE(`finished_at`, NOW(3)),
  `applied_steps_count` = GREATEST(`applied_steps_count`, 1),
  `logs` = NULL,
  `rolled_back_at` = NULL
WHERE `migration_name` = '20260727160000_admin_module_administrators'
  AND `finished_at` IS NULL;

/* ── 3) Verify ── */
SELECT
  migration_name,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM `_prisma_migrations`
WHERE migration_name = '20260727160000_admin_module_administrators';

SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='module_administrators') AS has_module_administrators,
  (SELECT COUNT(*) FROM `_prisma_migrations` WHERE migration_name='20260727160000_admin_module_administrators' AND finished_at IS NOT NULL) AS migration_applied;

SELECT 'P3009 blocker cleared — redeploy Hostinger build' AS status;
