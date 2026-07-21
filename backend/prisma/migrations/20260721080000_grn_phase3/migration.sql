-- Phase 3: Goods Receipt Note (GRN) foundation
-- Additive only — no data loss.

-- AlterEnum: CodeSeriesEntity += GOODS_RECEIPT
ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER',
  'LEAD',
  'CONTACT',
  'CRM_COMPANY',
  'OPPORTUNITY',
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_REQUISITION',
  'PURCHASE_PLANNING',
  'REQUEST_FOR_QUOTATION',
  'VENDOR_QUOTATION',
  'VENDOR_COMPARISON',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT'
) NOT NULL;

-- AlterEnum: PurchaseStatusHistoryDocumentType += GOODS_RECEIPT
ALTER TABLE `purchase_status_histories` MODIFY COLUMN `documentType` ENUM(
  'PURCHASE_REQUISITION',
  'PURCHASE_REQUISITION_LINE',
  'PURCHASE_PLANNING_ROW',
  'REQUEST_FOR_QUOTATION',
  'VENDOR_QUOTATION',
  'VENDOR_COMPARISON',
  'PURCHASE_ORDER',
  'PURCHASE_APPROVAL',
  'GOODS_RECEIPT'
) NOT NULL;

CREATE TABLE `goods_receipts` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `grnNumber` VARCHAR(64) NOT NULL,
    `receiptDate` DATE NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `vendorNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `purchaseOrderNumber` VARCHAR(64) NOT NULL DEFAULT '',
    `status` ENUM('DRAFT', 'SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED', 'INVENTORY_POSTED', 'CANCELLED', 'REVERSED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `plantId` VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `warehouseCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
    `warehouseNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '',
    `storageLocationId` VARCHAR(191) NULL,
    `storageLocationCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
    `storageLocationNameSnapshot` VARCHAR(200) NOT NULL DEFAULT '',
    `vendorChallanNumber` VARCHAR(100) NULL,
    `vendorChallanDate` DATE NULL,
    `vendorInvoiceNumber` VARCHAR(100) NULL,
    `vehicleNumber` VARCHAR(64) NULL,
    `transporterName` VARCHAR(200) NULL,
    `lrNumber` VARCHAR(64) NULL,
    `gateEntryNumber` VARCHAR(64) NULL,
    `receivedById` VARCHAR(36) NULL,
    `receivedByName` VARCHAR(200) NULL,
    `inspectionRequired` BOOLEAN NOT NULL DEFAULT false,
    `allowExcess` BOOLEAN NOT NULL DEFAULT false,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `reversedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `goods_receipts_tenantId_idx`(`tenantId`),
    INDEX `goods_receipts_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `goods_receipts_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `goods_receipts_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `goods_receipts_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `goods_receipts_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `goods_receipts_tenantId_receiptDate_idx`(`tenantId`, `receiptDate`),
    INDEX `goods_receipts_tenantId_vendorChallanNumber_idx`(`tenantId`, `vendorChallanNumber`),
    UNIQUE INDEX `goods_receipts_tenantId_grnNumber_key`(`tenantId`, `grnNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `goods_receipt_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `goodsReceiptId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `purchaseOrderLineId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `uomId` VARCHAR(191) NULL,
    `uomCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
    `orderedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `previouslyReceivedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `openQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `challanQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `receivedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `damagedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `shortQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `excessQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `acceptedForQcQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `acceptedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `warehouseId` VARCHAR(191) NULL,
    `storageLocationId` VARCHAR(191) NULL,
    `binId` VARCHAR(191) NULL,
    `binCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
    `batchNumber` VARCHAR(64) NULL,
    `heatNumber` VARCHAR(64) NULL,
    `lotNumber` VARCHAR(64) NULL,
    `serialNumber` VARCHAR(100) NULL,
    `manufacturingDate` DATE NULL,
    `expiryDate` DATE NULL,
    `qcRequired` BOOLEAN NOT NULL DEFAULT false,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `goods_receipt_lines_tenantId_idx`(`tenantId`),
    INDEX `goods_receipt_lines_tenantId_goodsReceiptId_idx`(`tenantId`, `goodsReceiptId`),
    INDEX `goods_receipt_lines_tenantId_purchaseOrderLineId_idx`(`tenantId`, `purchaseOrderLineId`),
    INDEX `goods_receipt_lines_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `goods_receipt_lines_tenantId_storageLocationId_idx`(`tenantId`, `storageLocationId`),
    INDEX `goods_receipt_lines_tenantId_binId_idx`(`tenantId`, `binId`),
    UNIQUE INDEX `goods_receipt_lines_tenantId_goodsReceiptId_lineNumber_key`(`tenantId`, `goodsReceiptId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `master_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_goodsReceiptId_fkey` FOREIGN KEY (`goodsReceiptId`) REFERENCES `goods_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_purchaseOrderLineId_fkey` FOREIGN KEY (`purchaseOrderLineId`) REFERENCES `purchase_order_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_storageLocationId_fkey` FOREIGN KEY (`storageLocationId`) REFERENCES `master_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_binId_fkey` FOREIGN KEY (`binId`) REFERENCES `master_bins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
