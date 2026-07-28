-- CEO Executive Dashboard Builder

CREATE TABLE `executive_dashboards` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` VARCHAR(1000) NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isShared` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `exec_dash_tenant_user_name_uidx`(`tenantId`, `userId`, `name`),
  INDEX `executive_dashboards_tenantId_idx`(`tenantId`),
  INDEX `executive_dashboards_tenantId_userId_idx`(`tenantId`, `userId`),
  INDEX `executive_dashboards_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
  INDEX `executive_dashboards_tenantId_isShared_idx`(`tenantId`, `isShared`),
  CONSTRAINT `executive_dashboards_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `executive_dashboard_widgets` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `dashboardId` VARCHAR(191) NOT NULL,
  `widgetKey` VARCHAR(100) NOT NULL,
  `positionX` INT NOT NULL DEFAULT 0,
  `positionY` INT NOT NULL DEFAULT 0,
  `width` INT NOT NULL DEFAULT 2,
  `height` INT NOT NULL DEFAULT 2,
  `visualization` VARCHAR(32) NULL,
  `configurationJson` JSON NULL,
  `filterJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `executive_dashboard_widgets_tenantId_idx`(`tenantId`),
  INDEX `executive_dashboard_widgets_tenantId_dashboardId_idx`(`tenantId`, `dashboardId`),
  INDEX `executive_dashboard_widgets_dashboardId_idx`(`dashboardId`),
  CONSTRAINT `executive_dashboard_widgets_dashboardId_fkey` FOREIGN KEY (`dashboardId`) REFERENCES `executive_dashboards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
