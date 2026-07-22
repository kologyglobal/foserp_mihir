-- Phase 7D — Reporting foundation: saved report views + operational exception centre overlay.
-- Additive only. No changes to existing tables. Reports are computed on read from
-- existing operational tables; these two tables only persist user preferences
-- (saved filter/column/sort presets) and ack/assign/resolve state for exceptions
-- that are otherwise derived live from source tables.

CREATE TABLE `saved_report_views` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reportKey` VARCHAR(100) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `filtersJson` JSON NOT NULL,
    `sortingJson` JSON NULL,
    `groupingJson` JSON NULL,
    `visibleColumnsJson` JSON NULL,
    `pageSize` INTEGER NULL,
    `chartPreferenceJson` JSON NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isShared` BOOLEAN NOT NULL DEFAULT false,
    `sharedRoleId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `saved_report_view_tenant_user_key_name_key`(`tenantId`, `userId`, `reportKey`, `name`),
    INDEX `saved_report_view_tenant_user_key_idx`(`tenantId`, `userId`, `reportKey`),
    INDEX `saved_report_view_tenant_key_shared_idx`(`tenantId`, `reportKey`, `isShared`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `operational_exception_actions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `exceptionKey` VARCHAR(200) NOT NULL,
    `sourceType` VARCHAR(64) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `assignedTo` VARCHAR(191) NULL,
    `acknowledgedBy` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `resolutionStatus` ENUM('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolutionNote` VARCHAR(1000) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `op_exception_action_tenant_key_key`(`tenantId`, `exceptionKey`),
    INDEX `op_exception_action_tenant_status_idx`(`tenantId`, `resolutionStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `saved_report_views`
    ADD CONSTRAINT `saved_report_views_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `operational_exception_actions`
    ADD CONSTRAINT `operational_exception_actions_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
