-- Purchase Phase 03: PR / Planning / RFQ / VQ / Comparison / PO / Approvals / Status history
-- Additive only. No DROP. FK ON DELETE RESTRICT (or SET NULL for optional refs).

CREATE TABLE `purchase_requisitions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requisitionNumber` VARCHAR(64) NOT NULL,
    `requisitionDate` DATE NOT NULL,
    `departmentId` VARCHAR(36) NULL,
    `requestedById` VARCHAR(36) NULL,
    `warehouseId` VARCHAR(191) NULL,
    `requiredDate` DATE NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `purchasePurpose` TEXT NULL,
    `rfqRequired` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_CONVERTED', 'CONVERTED_TO_PO', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `purchase_requisitions_tenantId_idx`(`tenantId`),
    INDEX `purchase_requisitions_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_requisitions_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `purchase_requisitions_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`),
    INDEX `purchase_requisitions_tenantId_requestedById_idx`(`tenantId`, `requestedById`),
    INDEX `purchase_requisitions_tenantId_requisitionDate_idx`(`tenantId`, `requisitionDate`),
    INDEX `purchase_requisitions_tenantId_rfqRequired_idx`(`tenantId`, `rfqRequired`),
    UNIQUE INDEX `purchase_requisitions_tenantId_requisitionNumber_key`(`tenantId`, `requisitionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_requisition_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `requiredQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `estimatedRate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `estimatedAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `warehouseId` VARCHAR(191) NULL,
    `binId` VARCHAR(36) NULL,
    `preferredVendorId` VARCHAR(191) NULL,
    `requiredDate` DATE NULL,
    `remarks` TEXT NULL,
    `status` ENUM('OPEN', 'CANCELLED', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_requisition_lines_tenantId_idx`(`tenantId`),
    INDEX `purchase_requisition_lines_tenantId_purchaseRequisitionId_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `purchase_requisition_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
    INDEX `purchase_requisition_lines_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_requisition_lines_tenantId_preferredVendorId_idx`(`tenantId`, `preferredVendorId`),
    UNIQUE INDEX `purchase_requisition_lines_tenantId_purchaseRequisitionId_li_key`(`tenantId`, `purchaseRequisitionId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_planning_rows` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planningNumber` VARCHAR(64) NOT NULL,
    `planningDate` DATE NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionLineId` VARCHAR(191) NOT NULL,
    `purchaseRequisitionNumberSnapshot` VARCHAR(64) NOT NULL,
    `departmentId` VARCHAR(36) NULL,
    `requestedById` VARCHAR(36) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `itemDescriptionSnapshot` TEXT NULL,
    `requiredQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `currentStockQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `openPurchaseOrderQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netPurchaseQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `preferredVendorId` VARCHAR(191) NULL,
    `selectedVendorId` VARCHAR(191) NULL,
    `lastPurchaseVendorId` VARCHAR(191) NULL,
    `lastPurchaseRate` DECIMAL(18, 2) NULL,
    `expectedRate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `negotiatedRate` DECIMAL(18, 2) NULL,
    `estimatedAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `requiredDate` DATE NULL,
    `purchaseType` ENUM('DIRECT_PURCHASE', 'RFQ_BASED', 'RATE_CONTRACT', 'OTHER') NOT NULL DEFAULT 'DIRECT_PURCHASE',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `buyerId` VARCHAR(36) NULL,
    `status` ENUM('PENDING_PLANNING', 'UNDER_REVIEW', 'VENDOR_SELECTED', 'APPROVED', 'PO_PENDING', 'PO_CREATED', 'PARTIALLY_ORDERED', 'ON_HOLD', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_PLANNING',
    `actionMessage` BOOLEAN NOT NULL DEFAULT false,
    `purchaseOrderId` VARCHAR(191) NULL,
    `purchaseOrderNumberSnapshot` VARCHAR(64) NULL,
    `convertedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `purchase_planning_rows_purchaseRequisitionLineId_key`(`purchaseRequisitionLineId`),
    INDEX `purchase_planning_rows_tenantId_idx`(`tenantId`),
    INDEX `purchase_planning_rows_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_planning_rows_tenantId_purchaseRequisitionId_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `purchase_planning_rows_tenantId_purchaseRequisitionLineId_idx`(`tenantId`, `purchaseRequisitionLineId`),
    INDEX `purchase_planning_rows_tenantId_selectedVendorId_idx`(`tenantId`, `selectedVendorId`),
    INDEX `purchase_planning_rows_tenantId_buyerId_idx`(`tenantId`, `buyerId`),
    INDEX `purchase_planning_rows_tenantId_requiredDate_idx`(`tenantId`, `requiredDate`),
    INDEX `purchase_planning_rows_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_planning_rows_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `purchase_planning_rows_tenantId_actionMessage_idx`(`tenantId`, `actionMessage`),
    UNIQUE INDEX `purchase_planning_rows_tenantId_purchaseRequisitionLineId_key`(`tenantId`, `purchaseRequisitionLineId`),
    UNIQUE INDEX `purchase_planning_rows_tenantId_planningNumber_key`(`tenantId`, `planningNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_for_quotations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `rfqNumber` VARCHAR(64) NOT NULL,
    `rfqDate` DATE NOT NULL,
    `purchaseRequisitionId` VARCHAR(191) NULL,
    `title` VARCHAR(300) NULL,
    `responseDueDate` DATE NULL,
    `status` ENUM('DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'UNDER_COMPARISON', 'VENDOR_SELECTED', 'CONVERTED_TO_PO', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `request_for_quotations_tenantId_idx`(`tenantId`),
    INDEX `request_for_quotations_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `request_for_quotations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `request_for_quotations_tenantId_purchaseRequisitionId_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `request_for_quotations_tenantId_rfqDate_idx`(`tenantId`, `rfqDate`),
    UNIQUE INDEX `request_for_quotations_tenantId_rfqNumber_key`(`tenantId`, `rfqNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_for_quotation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestForQuotationId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `purchaseRequisitionLineId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `requiredQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `targetRate` DECIMAL(18, 2) NULL,
    `requiredDate` DATE NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `request_for_quotation_lines_tenantId_idx`(`tenantId`),
    INDEX `request_for_quotation_lines_tenantId_requestForQuotationId_idx`(`tenantId`, `requestForQuotationId`),
    INDEX `request_for_quotation_lines_tenantId_purchaseRequisitionLine_idx`(`tenantId`, `purchaseRequisitionLineId`),
    INDEX `request_for_quotation_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
    UNIQUE INDEX `request_for_quotation_lines_tenantId_requestForQuotationId_l_key`(`tenantId`, `requestForQuotationId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfq_vendors` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestForQuotationId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `inviteStatus` ENUM('INVITED', 'SENT', 'RESPONDED', 'DECLINED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'INVITED',
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rfq_vendors_tenantId_idx`(`tenantId`),
    INDEX `rfq_vendors_tenantId_requestForQuotationId_idx`(`tenantId`, `requestForQuotationId`),
    INDEX `rfq_vendors_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `rfq_vendors_tenantId_inviteStatus_idx`(`tenantId`, `inviteStatus`),
    UNIQUE INDEX `rfq_vendors_tenantId_requestForQuotationId_vendorId_key`(`tenantId`, `requestForQuotationId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_quotations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(64) NOT NULL,
    `quotationDate` DATE NOT NULL,
    `requestForQuotationId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SELECTED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `validUntil` DATE NULL,
    `paymentTerms` VARCHAR(200) NULL,
    `deliveryTerms` VARCHAR(200) NULL,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `vendor_quotations_tenantId_idx`(`tenantId`),
    INDEX `vendor_quotations_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `vendor_quotations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `vendor_quotations_tenantId_requestForQuotationId_idx`(`tenantId`, `requestForQuotationId`),
    INDEX `vendor_quotations_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    UNIQUE INDEX `vendor_quotations_tenantId_quotationNumber_key`(`tenantId`, `quotationNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_quotation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `vendorQuotationId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `requestForQuotationLineId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `leadTimeDays` INTEGER NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendor_quotation_lines_tenantId_idx`(`tenantId`),
    INDEX `vendor_quotation_lines_tenantId_vendorQuotationId_idx`(`tenantId`, `vendorQuotationId`),
    INDEX `vendor_quotation_lines_tenantId_requestForQuotationLineId_idx`(`tenantId`, `requestForQuotationLineId`),
    INDEX `vendor_quotation_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
    UNIQUE INDEX `vendor_quotation_lines_tenantId_vendorQuotationId_lineNumber_key`(`tenantId`, `vendorQuotationId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_comparisons` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `comparisonNumber` VARCHAR(64) NOT NULL,
    `comparisonDate` DATE NOT NULL,
    `requestForQuotationId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_COMPARISON', 'VENDOR_SELECTED', 'CONVERTED_TO_PO', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `awardedVendorId` VARCHAR(191) NULL,
    `awardedVendorQuotationId` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `selectedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `vendor_comparisons_tenantId_idx`(`tenantId`),
    INDEX `vendor_comparisons_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `vendor_comparisons_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `vendor_comparisons_tenantId_requestForQuotationId_idx`(`tenantId`, `requestForQuotationId`),
    INDEX `vendor_comparisons_tenantId_awardedVendorId_idx`(`tenantId`, `awardedVendorId`),
    UNIQUE INDEX `vendor_comparisons_tenantId_comparisonNumber_key`(`tenantId`, `comparisonNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_comparison_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `vendorComparisonId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `requestForQuotationLineId` VARCHAR(191) NULL,
    `vendorQuotationId` VARCHAR(191) NULL,
    `vendorQuotationLineId` VARCHAR(191) NULL,
    `itemId` VARCHAR(36) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `rank` INTEGER NULL,
    `isSelected` BOOLEAN NOT NULL DEFAULT false,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendor_comparison_lines_tenantId_idx`(`tenantId`),
    INDEX `vendor_comparison_lines_tenantId_vendorComparisonId_idx`(`tenantId`, `vendorComparisonId`),
    INDEX `vendor_comparison_lines_tenantId_requestForQuotationLineId_idx`(`tenantId`, `requestForQuotationLineId`),
    INDEX `vendor_comparison_lines_tenantId_vendorQuotationId_idx`(`tenantId`, `vendorQuotationId`),
    INDEX `vendor_comparison_lines_tenantId_isSelected_idx`(`tenantId`, `isSelected`),
    UNIQUE INDEX `vendor_comparison_lines_tenantId_vendorComparisonId_lineNumb_key`(`tenantId`, `vendorComparisonId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(64) NOT NULL,
    `orderDate` DATE NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `origin` ENUM('MANUAL', 'PURCHASE_REQUISITION', 'PLANNING_SHEET', 'RFQ_COMPARISON', 'OTHER') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_VENDOR', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `purchaseRequisitionId` VARCHAR(191) NULL,
    `requestForQuotationId` VARCHAR(191) NULL,
    `vendorQuotationId` VARCHAR(191) NULL,
    `vendorComparisonId` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `expectedDeliveryDate` DATE NULL,
    `paymentTerms` VARCHAR(200) NULL,
    `deliveryTerms` VARCHAR(200) NULL,
    `subtotalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `freightAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdById` VARCHAR(36) NULL,
    `updatedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `purchase_orders_tenantId_idx`(`tenantId`),
    INDEX `purchase_orders_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_orders_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `purchase_orders_tenantId_vendorId_idx`(`tenantId`, `vendorId`),
    INDEX `purchase_orders_tenantId_purchaseRequisitionId_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `purchase_orders_tenantId_requestForQuotationId_idx`(`tenantId`, `requestForQuotationId`),
    INDEX `purchase_orders_tenantId_orderDate_idx`(`tenantId`, `orderDate`),
    INDEX `purchase_orders_tenantId_origin_idx`(`tenantId`, `origin`),
    UNIQUE INDEX `purchase_orders_tenantId_orderNumber_key`(`tenantId`, `orderNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `purchaseRequisitionLineId` VARCHAR(191) NULL,
    `purchasePlanningRowId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemCodeSnapshot` VARCHAR(64) NOT NULL DEFAULT '',
    `itemNameSnapshot` VARCHAR(300) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uomId` VARCHAR(191) NULL,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `receivedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `requiredDate` DATE NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_order_lines_tenantId_idx`(`tenantId`),
    INDEX `purchase_order_lines_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_order_lines_tenantId_purchaseRequisitionLineId_idx`(`tenantId`, `purchaseRequisitionLineId`),
    INDEX `purchase_order_lines_tenantId_purchasePlanningRowId_idx`(`tenantId`, `purchasePlanningRowId`),
    INDEX `purchase_order_lines_tenantId_itemId_idx`(`tenantId`, `itemId`),
    UNIQUE INDEX `purchase_order_lines_tenantId_purchaseOrderId_lineNumber_key`(`tenantId`, `purchaseOrderId`, `lineNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'REQUEST_FOR_QUOTATION', 'PURCHASE_PLANNING') NOT NULL,
    `documentId` VARCHAR(36) NOT NULL,
    `documentNumber` VARCHAR(64) NULL,
    `purchaseRequisitionId` VARCHAR(191) NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `approverRole` VARCHAR(64) NULL,
    `approverId` VARCHAR(36) NULL,
    `requesterId` VARCHAR(36) NULL,
    `amount` DECIMAL(18, 2) NULL,
    `remarks` TEXT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_approvals_tenantId_idx`(`tenantId`),
    INDEX `purchase_approvals_tenantId_documentType_documentId_idx`(`tenantId`, `documentType`, `documentId`),
    INDEX `purchase_approvals_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_approvals_tenantId_purchaseRequisitionId_idx`(`tenantId`, `purchaseRequisitionId`),
    INDEX `purchase_approvals_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    INDEX `purchase_approvals_tenantId_approverId_idx`(`tenantId`, `approverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_status_histories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('PURCHASE_REQUISITION', 'PURCHASE_REQUISITION_LINE', 'PURCHASE_PLANNING_ROW', 'REQUEST_FOR_QUOTATION', 'VENDOR_QUOTATION', 'VENDOR_COMPARISON', 'PURCHASE_ORDER', 'PURCHASE_APPROVAL') NOT NULL,
    `documentId` VARCHAR(36) NOT NULL,
    `documentNumber` VARCHAR(64) NULL,
    `action` VARCHAR(64) NOT NULL,
    `fromStatus` VARCHAR(64) NULL,
    `toStatus` VARCHAR(64) NULL,
    `actorId` VARCHAR(36) NULL,
    `actorName` VARCHAR(200) NULL,
    `remarks` TEXT NULL,
    `actedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_status_histories_tenantId_idx`(`tenantId`),
    INDEX `purchase_status_histories_tenantId_documentType_documentId_idx`(`tenantId`, `documentType`, `documentId`),
    INDEX `purchase_status_histories_tenantId_actedAt_idx`(`tenantId`, `actedAt`),
    INDEX `purchase_status_histories_tenantId_action_idx`(`tenantId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_requisitions` ADD CONSTRAINT `purchase_requisitions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisitions` ADD CONSTRAINT `purchase_requisitions_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_requisition_lines` ADD CONSTRAINT `purchase_requisition_lines_preferredVendorId_fkey` FOREIGN KEY (`preferredVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_purchaseRequisitionLineId_fkey` FOREIGN KEY (`purchaseRequisitionLineId`) REFERENCES `purchase_requisition_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_preferredVendorId_fkey` FOREIGN KEY (`preferredVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_selectedVendorId_fkey` FOREIGN KEY (`selectedVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_lastPurchaseVendorId_fkey` FOREIGN KEY (`lastPurchaseVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_planning_rows` ADD CONSTRAINT `purchase_planning_rows_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotations` ADD CONSTRAINT `request_for_quotations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotations` ADD CONSTRAINT `request_for_quotations_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotation_lines` ADD CONSTRAINT `request_for_quotation_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotation_lines` ADD CONSTRAINT `request_for_quotation_lines_requestForQuotationId_fkey` FOREIGN KEY (`requestForQuotationId`) REFERENCES `request_for_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotation_lines` ADD CONSTRAINT `request_for_quotation_lines_purchaseRequisitionLineId_fkey` FOREIGN KEY (`purchaseRequisitionLineId`) REFERENCES `purchase_requisition_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotation_lines` ADD CONSTRAINT `request_for_quotation_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_for_quotation_lines` ADD CONSTRAINT `request_for_quotation_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rfq_vendors` ADD CONSTRAINT `rfq_vendors_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rfq_vendors` ADD CONSTRAINT `rfq_vendors_requestForQuotationId_fkey` FOREIGN KEY (`requestForQuotationId`) REFERENCES `request_for_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rfq_vendors` ADD CONSTRAINT `rfq_vendors_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `master_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotations` ADD CONSTRAINT `vendor_quotations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotations` ADD CONSTRAINT `vendor_quotations_requestForQuotationId_fkey` FOREIGN KEY (`requestForQuotationId`) REFERENCES `request_for_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotations` ADD CONSTRAINT `vendor_quotations_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `master_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotation_lines` ADD CONSTRAINT `vendor_quotation_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotation_lines` ADD CONSTRAINT `vendor_quotation_lines_vendorQuotationId_fkey` FOREIGN KEY (`vendorQuotationId`) REFERENCES `vendor_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotation_lines` ADD CONSTRAINT `vendor_quotation_lines_requestForQuotationLineId_fkey` FOREIGN KEY (`requestForQuotationLineId`) REFERENCES `request_for_quotation_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotation_lines` ADD CONSTRAINT `vendor_quotation_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_quotation_lines` ADD CONSTRAINT `vendor_quotation_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparisons` ADD CONSTRAINT `vendor_comparisons_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparisons` ADD CONSTRAINT `vendor_comparisons_requestForQuotationId_fkey` FOREIGN KEY (`requestForQuotationId`) REFERENCES `request_for_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparisons` ADD CONSTRAINT `vendor_comparisons_awardedVendorId_fkey` FOREIGN KEY (`awardedVendorId`) REFERENCES `master_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparison_lines` ADD CONSTRAINT `vendor_comparison_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparison_lines` ADD CONSTRAINT `vendor_comparison_lines_vendorComparisonId_fkey` FOREIGN KEY (`vendorComparisonId`) REFERENCES `vendor_comparisons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparison_lines` ADD CONSTRAINT `vendor_comparison_lines_requestForQuotationLineId_fkey` FOREIGN KEY (`requestForQuotationLineId`) REFERENCES `request_for_quotation_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparison_lines` ADD CONSTRAINT `vendor_comparison_lines_vendorQuotationId_fkey` FOREIGN KEY (`vendorQuotationId`) REFERENCES `vendor_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_comparison_lines` ADD CONSTRAINT `vendor_comparison_lines_vendorQuotationLineId_fkey` FOREIGN KEY (`vendorQuotationLineId`) REFERENCES `vendor_quotation_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `master_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_requestForQuotationId_fkey` FOREIGN KEY (`requestForQuotationId`) REFERENCES `request_for_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorQuotationId_fkey` FOREIGN KEY (`vendorQuotationId`) REFERENCES `vendor_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorComparisonId_fkey` FOREIGN KEY (`vendorComparisonId`) REFERENCES `vendor_comparisons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_purchaseRequisitionLineId_fkey` FOREIGN KEY (`purchaseRequisitionLineId`) REFERENCES `purchase_requisition_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_purchasePlanningRowId_fkey` FOREIGN KEY (`purchasePlanningRowId`) REFERENCES `purchase_planning_rows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_approvals` ADD CONSTRAINT `purchase_approvals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_approvals` ADD CONSTRAINT `purchase_approvals_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_approvals` ADD CONSTRAINT `purchase_approvals_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_status_histories` ADD CONSTRAINT `purchase_status_histories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

