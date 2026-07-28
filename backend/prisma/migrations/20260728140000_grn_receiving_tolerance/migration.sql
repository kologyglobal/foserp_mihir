-- GRN receiving tolerance: item-level % + GRN line status + approval status

ALTER TABLE `master_items`
  ADD COLUMN `receivingTolerancePercentage` DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipts`
  ADD COLUMN `toleranceApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `toleranceApprovedAt` DATETIME(3) NULL,
  ADD COLUMN `toleranceApprovedById` VARCHAR(36) NULL;

-- MySQL enum alter for GoodsReceiptStatus
ALTER TABLE `goods_receipts`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'PENDING_TOLERANCE_APPROVAL',
    'SUBMITTED',
    'RECEIVING_COMPLETED',
    'QC_PENDING',
    'PARTIALLY_ACCEPTED',
    'FULLY_ACCEPTED',
    'INVENTORY_POSTED',
    'CANCELLED',
    'REVERSED',
    'CLOSED'
  ) NOT NULL DEFAULT 'DRAFT';

CREATE TABLE IF NOT EXISTS `_grn_line_tol_status_tmp` (
  `v` VARCHAR(32) NOT NULL
);

-- Add GRN line tolerance columns
ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `tolerancePercentage` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `variancePercentage` DECIMAL(9, 4) NULL,
  ADD COLUMN `toleranceStatus` ENUM(
    'OK',
    'PARTIAL',
    'NOT_RECEIVED',
    'SHORT_OUTSIDE',
    'EXCESS_WITHIN',
    'EXCESS_OUTSIDE'
  ) NOT NULL DEFAULT 'OK',
  ADD COLUMN `closeOpenQuantity` BOOLEAN NOT NULL DEFAULT false;

-- PurchaseApprovalDocumentType: add GOODS_RECEIPT
ALTER TABLE `purchase_approvals`
  MODIFY COLUMN `documentType` ENUM(
    'PURCHASE_REQUISITION',
    'PURCHASE_ORDER',
    'REQUEST_FOR_QUOTATION',
    'PURCHASE_PLANNING',
    'GOODS_RECEIPT'
  ) NOT NULL;

DROP TABLE IF EXISTS `_grn_line_tol_status_tmp`;
