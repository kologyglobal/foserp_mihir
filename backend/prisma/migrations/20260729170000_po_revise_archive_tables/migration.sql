-- CreateTable
CREATE TABLE `purchase_order_archived` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `revisionNo` INTEGER NOT NULL,
    `orderNumber` VARCHAR(64) NOT NULL,
    `orderDate` DATE NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `origin` ENUM('MANUAL', 'PURCHASE_REQUISITION', 'PLANNING_SHEET', 'RFQ_COMPARISON', 'OTHER') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT_BACK', 'SENT_TO_VENDOR', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'CANCELLED', 'CLOSED') NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NULL,
    `requestForQuotationId` VARCHAR(191) NULL,
    `vendorQuotationId` VARCHAR(191) NULL,
    `vendorComparisonId` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `expectedDeliveryDate` DATE NULL,
    `paymentTerms` VARCHAR(200) NULL,
    `deliveryTerms` VARCHAR(200) NULL,
    `deliveryWarehouseId` VARCHAR(191) NULL,
    `subtotalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `archivedById` VARCHAR(36) NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` TEXT NOT NULL,

    UNIQUE INDEX `purchase_order_archived_tenantId_purchaseOrderId_revisionNo_key`(`tenantId`, `purchaseOrderId`, `revisionNo`),
    INDEX `purchase_order_archived_tenantId_idx`(`tenantId`),
    INDEX `purchase_order_archived_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_line_archived` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `archivedHeaderId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `sourceLineId` VARCHAR(191) NULL,
    `revisionNo` INTEGER NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `purchaseRequisitionLineId` VARCHAR(191) NULL,
    `purchasePlanningRowId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomConversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `unitCostPrimary` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `receivedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `requiredDate` DATE NULL,
    `requisitionNumber` VARCHAR(64) NULL,
    `remarks` TEXT NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_line_archived_tenantId_idx`(`tenantId`),
    INDEX `purchase_line_archived_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_line_archived_tenantId_archivedHeaderId_idx`(`tenantId`, `archivedHeaderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_order_archived` ADD CONSTRAINT `purchase_order_archived_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_archived` ADD CONSTRAINT `purchase_order_archived_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_line_archived` ADD CONSTRAINT `purchase_line_archived_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_line_archived` ADD CONSTRAINT `purchase_line_archived_archivedHeaderId_fkey` FOREIGN KEY (`archivedHeaderId`) REFERENCES `purchase_order_archived`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
