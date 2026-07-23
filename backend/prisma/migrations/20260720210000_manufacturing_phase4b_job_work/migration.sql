-- Manufacturing Phase 4B: Job Work / subcontracting foundation

-- Extend code series enum for JW- numbers (MySQL ENUM — invalid values store as '')
ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER'
) NOT NULL;

ALTER TABLE `quality_inspections` ADD COLUMN `jobWorkOrderId` VARCHAR(191) NULL;

CREATE TABLE `job_work_orders` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `jwNumber` VARCHAR(64) NOT NULL,
  `status` ENUM('DRAFT','MATERIAL_SENT','PARTIALLY_RECEIVED','RECEIVED','RECONCILIATION_PENDING','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `vendorId` VARCHAR(191) NOT NULL, `productionOrderId` VARCHAR(191) NULL, `processName` VARCHAR(200) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL, `uomId` VARCHAR(191) NULL, `orderedQty` DECIMAL(18,4) NOT NULL,
  `sentQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `receivedQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `acceptedQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `rejectedQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `reworkQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `rate` DECIMAL(18,4) NOT NULL DEFAULT 0, `rateBasis` ENUM('PER_PIECE','PER_KG','PER_HOUR','PER_BATCH','FIXED') NOT NULL DEFAULT 'PER_PIECE',
  `expectedCost` DECIMAL(18,4) NOT NULL DEFAULT 0, `expectedReturnDate` DATE NULL,
  `invoiceStatus` ENUM('NONE','LINKED','PENDING') NOT NULL DEFAULT 'NONE', `invoiceId` VARCHAR(191) NULL, `invoiceNo` VARCHAR(100) NULL, `invoiceAmount` DECIMAL(18,4) NULL,
  `materialWarehouseId` VARCHAR(191) NOT NULL, `receiptWarehouseId` VARCHAR(191) NOT NULL, `plantId` VARCHAR(191) NULL,
  `qualityRequired` BOOLEAN NOT NULL DEFAULT false, `materialSentAt` DATETIME(3) NULL, `vendorChallan` VARCHAR(100) NULL,
  `transporter` VARCHAR(200) NULL, `vehicle` VARCHAR(100) NULL, `deliveryAddress` TEXT NULL, `drawingRevision` VARCHAR(100) NULL,
  `qualityInstructions` TEXT NULL, `remarks` TEXT NULL, `materialToSend` TEXT NULL, `differenceApproved` BOOLEAN NOT NULL DEFAULT false,
  `differenceReason` TEXT NULL, `idempotencyKey` VARCHAR(150) NULL, `createdBy` VARCHAR(191) NULL, `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `job_work_orders_tenantId_jwNumber_key` (`tenantId`,`jwNumber`),
  UNIQUE INDEX `job_work_orders_tenantId_idempotencyKey_key` (`tenantId`,`idempotencyKey`),
  INDEX `job_work_orders_tenantId_status_idx` (`tenantId`,`status`), INDEX `job_work_orders_tenantId_vendorId_idx` (`tenantId`,`vendorId`),
  INDEX `job_work_orders_tenantId_productionOrderId_idx` (`tenantId`,`productionOrderId`), INDEX `job_work_orders_tenantId_deletedAt_idx` (`tenantId`,`deletedAt`),
  CONSTRAINT `job_work_orders_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `job_work_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `master_vendors` (`id`),
  CONSTRAINT `job_work_orders_productionOrderId_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`),
  CONSTRAINT `job_work_orders_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`),
  CONSTRAINT `job_work_orders_materialWarehouseId_fkey` FOREIGN KEY (`materialWarehouseId`) REFERENCES `master_warehouses` (`id`),
  CONSTRAINT `job_work_orders_receiptWarehouseId_fkey` FOREIGN KEY (`receiptWarehouseId`) REFERENCES `master_warehouses` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `job_work_material_lines` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `jobWorkOrderId` VARCHAR(191) NOT NULL, `lineNo` INTEGER NOT NULL,
  `itemId` VARCHAR(191) NOT NULL, `uomId` VARCHAR(191) NULL, `requiredQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `sentQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `additionalSentQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `consumedQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `returnedQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `scrapReturnedQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `status` ENUM('PENDING','PARTIAL','SENT','RECONCILED','DIFFERENCE') NOT NULL DEFAULT 'PENDING',
  `remarks` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `job_work_material_lines_jobWorkOrderId_lineNo_key` (`jobWorkOrderId`,`lineNo`),
  INDEX `job_work_material_lines_tenantId_jobWorkOrderId_idx` (`tenantId`,`jobWorkOrderId`), INDEX `job_work_material_lines_tenantId_itemId_idx` (`tenantId`,`itemId`),
  CONSTRAINT `job_work_material_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `job_work_material_lines_jobWorkOrderId_fkey` FOREIGN KEY (`jobWorkOrderId`) REFERENCES `job_work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_work_material_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `job_work_dispatches` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `jobWorkOrderId` VARCHAR(191) NOT NULL, `dispatchNumber` VARCHAR(64) NULL,
  `dispatchedAt` DATETIME(3) NOT NULL, `vendorChallan` VARCHAR(100) NULL, `vehicle` VARCHAR(100) NULL, `transporter` VARCHAR(200) NULL, `remarks` TEXT NULL,
  `createdBy` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `job_work_dispatches_tenantId_jobWorkOrderId_idx` (`tenantId`,`jobWorkOrderId`),
  CONSTRAINT `job_work_dispatches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `job_work_dispatches_jobWorkOrderId_fkey` FOREIGN KEY (`jobWorkOrderId`) REFERENCES `job_work_orders` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `job_work_dispatch_lines` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `dispatchId` VARCHAR(191) NOT NULL, `materialLineId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18,4) NOT NULL, `batchOrSerial` VARCHAR(200) NULL, PRIMARY KEY (`id`), INDEX `job_work_dispatch_lines_tenantId_dispatchId_idx` (`tenantId`,`dispatchId`),
  CONSTRAINT `job_work_dispatch_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `job_work_dispatch_lines_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `job_work_dispatches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_work_dispatch_lines_materialLineId_fkey` FOREIGN KEY (`materialLineId`) REFERENCES `job_work_material_lines` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `job_work_receipts` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `jobWorkOrderId` VARCHAR(191) NOT NULL, `receivedAt` DATETIME(3) NOT NULL,
  `receivedQty` DECIMAL(18,4) NOT NULL, `acceptedQty` DECIMAL(18,4) NOT NULL, `rejectedQty` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reworkQty` DECIMAL(18,4) NOT NULL DEFAULT 0, `scrapReturned` DECIMAL(18,4) NOT NULL DEFAULT 0, `unusedReturned` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `vendorChallan` VARCHAR(100) NULL, `batchOrSerial` VARCHAR(200) NULL, `remarks` TEXT NULL, `qualityInspectionId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `job_work_receipts_tenantId_jobWorkOrderId_idx` (`tenantId`,`jobWorkOrderId`),
  CONSTRAINT `job_work_receipts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `job_work_receipts_jobWorkOrderId_fkey` FOREIGN KEY (`jobWorkOrderId`) REFERENCES `job_work_orders` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `quality_inspections_tenantId_jobWorkOrderId_idx` ON `quality_inspections`(`tenantId`,`jobWorkOrderId`);
ALTER TABLE `quality_inspections` ADD CONSTRAINT `quality_inspections_jobWorkOrderId_fkey` FOREIGN KEY (`jobWorkOrderId`) REFERENCES `job_work_orders`(`id`);
