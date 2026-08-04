-- PR versioning (mirror PO revision model).
-- Idempotent; short index names (MySQL 64-char identifier limit).

SELECT DATABASE() AS db_name, NOW() AS run_at;

SET @db = DATABASE();

SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisitions' AND COLUMN_NAME = 'revisionNo'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_requisitions` ADD COLUMN `revisionNo` INT NOT NULL DEFAULT 0',
  'SELECT ''purchase_requisitions.revisionNo exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_settings' AND COLUMN_NAME = 'requireApprovalOnPrRevision'
);
SET @sql = IF(
  @col = 0,
  'ALTER TABLE `purchase_settings` ADD COLUMN `requireApprovalOnPrRevision` BOOLEAN NOT NULL DEFAULT true',
  'SELECT ''purchase_settings.requireApprovalOnPrRevision exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl = (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_revisions'
);
SET @sql = IF(
  @tbl = 0,
  'CREATE TABLE `purchase_requisition_revisions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NOT NULL,
    `revisionNo` INT NOT NULL,
    `reason` TEXT NOT NULL,
    `statusBefore` VARCHAR(40) NOT NULL,
    `statusAfter` VARCHAR(40) NOT NULL,
    `revisedById` VARCHAR(36) NULL,
    `revisedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `headerSnapshot` JSON NOT NULL,
    `linesSnapshot` JSON NOT NULL,
    `changes` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `pr_req_rev_tenant_pr_rev_key`(`tenantId`, `purchaseRequisitionId`, `revisionNo`),
    INDEX `pr_req_rev_tenant_idx`(`tenantId`),
    INDEX `pr_req_rev_tenant_pr_idx`(`tenantId`, `purchaseRequisitionId`),
    PRIMARY KEY (`id`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT ''purchase_requisition_revisions exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl = (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_archived'
);
SET @sql = IF(
  @tbl = 0,
  'CREATE TABLE `purchase_requisition_archived` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NOT NULL,
    `revisionNo` INT NOT NULL,
    `requisitionNumber` VARCHAR(64) NOT NULL,
    `requisitionDate` DATE NOT NULL,
    `departmentId` VARCHAR(36) NULL,
    `requestedById` VARCHAR(36) NULL,
    `warehouseId` VARCHAR(191) NULL,
    `requiredDate` DATE NULL,
    `priority` ENUM(''LOW'', ''NORMAL'', ''HIGH'', ''URGENT'', ''CRITICAL'') NOT NULL DEFAULT ''NORMAL'',
    `purchasePurpose` TEXT NULL,
    `rfqRequired` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM(''DRAFT'', ''SUBMITTED'', ''PENDING_APPROVAL'', ''APPROVED'', ''REJECTED'', ''PARTIALLY_CONVERTED'', ''CONVERTED_TO_PO'', ''CANCELLED'', ''CLOSED'') NOT NULL DEFAULT ''DRAFT'',
    `remarks` TEXT NULL,
    `archivedById` VARCHAR(36) NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` TEXT NOT NULL,
    UNIQUE INDEX `pr_req_arch_tenant_pr_rev_key`(`tenantId`, `purchaseRequisitionId`, `revisionNo`),
    INDEX `pr_req_arch_tenant_idx`(`tenantId`),
    INDEX `pr_req_arch_tenant_pr_idx`(`tenantId`, `purchaseRequisitionId`),
    PRIMARY KEY (`id`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT ''purchase_requisition_archived exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl = (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_line_archived'
);
SET @sql = IF(
  @tbl = 0,
  'CREATE TABLE `purchase_requisition_line_archived` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `archivedHeaderId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NOT NULL,
    `sourceLineId` VARCHAR(191) NULL,
    `revisionNo` INT NOT NULL,
    `lineNumber` INT NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '''',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '''',
    `description` TEXT NULL,
    `requiredQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `estimatedRate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `estimatedAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `preferredVendorId` VARCHAR(191) NULL,
    `requiredDate` DATE NULL,
    `remarks` TEXT NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `pr_req_line_arch_tenant_idx`(`tenantId`),
    INDEX `pr_req_line_arch_tenant_pr_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `pr_req_line_arch_hdr_idx`(`tenantId`, `archivedHeaderId`),
    PRIMARY KEY (`id`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT ''purchase_requisition_line_archived exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_revisions'
    AND CONSTRAINT_NAME = 'purchase_requisition_revisions_tenantId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_revisions` ADD CONSTRAINT `purchase_requisition_revisions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''pr revisions tenant fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_revisions'
    AND CONSTRAINT_NAME = 'purchase_requisition_revisions_purchaseRequisitionId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_revisions` ADD CONSTRAINT `purchase_requisition_revisions_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''pr revisions pr fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_archived'
    AND CONSTRAINT_NAME = 'purchase_requisition_archived_tenantId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_archived` ADD CONSTRAINT `purchase_requisition_archived_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''pr archived tenant fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_archived'
    AND CONSTRAINT_NAME = 'purchase_requisition_archived_purchaseRequisitionId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_archived` ADD CONSTRAINT `purchase_requisition_archived_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''pr archived pr fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_line_archived'
    AND CONSTRAINT_NAME = 'purchase_requisition_line_archived_tenantId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_line_archived` ADD CONSTRAINT `purchase_requisition_line_archived_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT ''pr line archived tenant fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_requisition_line_archived'
    AND CONSTRAINT_NAME = 'purchase_requisition_line_archived_archivedHeaderId_fkey'
);
SET @sql = IF(
  @fk = 0,
  'ALTER TABLE `purchase_requisition_line_archived` ADD CONSTRAINT `purchase_requisition_line_archived_archivedHeaderId_fkey` FOREIGN KEY (`archivedHeaderId`) REFERENCES `purchase_requisition_archived`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT ''pr line archived header fk exists'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
