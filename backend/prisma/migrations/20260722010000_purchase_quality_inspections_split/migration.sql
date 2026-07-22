-- Split Purchase GRN QC from manufacturing Quality SoT.
-- `quality_inspections` remains manufacturing-owned (Phase 4A+).
-- Purchase QI moves to dedicated tables. Prisma maps ManufacturingQualityInspection → quality_inspections.

-- Code series: dedicated purchase QI numbering (avoid collision with manufacturing QUALITY_INSPECTION)
ALTER TABLE `code_series` MODIFY `entityType` ENUM(
  'USER',
  'LEAD',
  'CONTACT',
  'CRM_COMPANY',
  'OPPORTUNITY',
  'QUOTATION',
  'SALES_ORDER',
  'PRODUCTION_DEMAND',
  'PRODUCTION_ORDER',
  'DAILY_PRODUCTION_BATCH',
  'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT',
  'STOCK_RESERVATION',
  'PURCHASE_REQUISITION',
  'PURCHASE_PLANNING',
  'REQUEST_FOR_QUOTATION',
  'VENDOR_QUOTATION',
  'VENDOR_COMPARISON',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'QUALITY_INSPECTION',
  'PURCHASE_QUALITY_INSPECTION',
  'QUALITY_NCR',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'JOB_WORK_ORDER',
  'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT',
  'MANUFACTURING_CORRECTION',
  'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN',
  'OUTBOUND_DISPATCH',
  'PRODUCTION_FG_RECEIPT',
  'DISPATCH_REQUIREMENT',
  'DISPATCH_PICK_LIST',
  'DISPATCH_PACKING_SESSION',
  'DISPATCH_PACKAGE',
  'DELIVERY_CHALLAN'
) NOT NULL;

CREATE TABLE IF NOT EXISTS `purchase_quality_inspections` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `inspectionNumber` VARCHAR(64) NOT NULL,
  `inspectionDate` DATE NOT NULL,
  `goodsReceiptId` VARCHAR(191) NULL,
  `purchaseOrderId` VARCHAR(191) NULL,
  `vendorId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT', 'PENDING', 'IN_PROGRESS', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'DEVIATION_PENDING', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `warehouseId` VARCHAR(191) NULL,
  `remarks` TEXT NULL,
  `deviationRemarks` TEXT NULL,
  `inspectedById` VARCHAR(36) NULL,
  `inspectedByName` VARCHAR(200) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdById` VARCHAR(36) NULL,
  `updatedById` VARCHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `pqi_tenant_insp_number_key`(`tenantId`, `inspectionNumber`),
  INDEX `pqi_tenant_idx`(`tenantId`),
  INDEX `pqi_tenant_status_idx`(`tenantId`, `status`),
  INDEX `pqi_tenant_deleted_idx`(`tenantId`, `deletedAt`),
  INDEX `pqi_tenant_grn_idx`(`tenantId`, `goodsReceiptId`),
  INDEX `pqi_tenant_po_idx`(`tenantId`, `purchaseOrderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_quality_inspection_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `qualityInspectionId` VARCHAR(191) NOT NULL,
  `lineNumber` INT NOT NULL,
  `goodsReceiptLineId` VARCHAR(191) NULL,
  `purchaseOrderLineId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NULL,
  `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
  `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
  `inspectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `acceptedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `deviationQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pqi_lines_tenant_qi_lineno_key`(`tenantId`, `qualityInspectionId`, `lineNumber`),
  INDEX `pqi_lines_tenant_idx`(`tenantId`),
  INDEX `pqi_lines_tenant_qi_idx`(`tenantId`, `qualityInspectionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_quality_inspections`
  ADD CONSTRAINT `pqi_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_quality_inspection_lines`
  ADD CONSTRAINT `pqi_lines_tenant_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pqi_lines_qi_fkey`
    FOREIGN KEY (`qualityInspectionId`) REFERENCES `purchase_quality_inspections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
