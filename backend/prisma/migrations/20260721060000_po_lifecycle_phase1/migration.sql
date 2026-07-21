-- PO lifecycle Phase 1: full status set + rejection/send-back tracking + line quantity tracking
-- Additive only — no data loss. Existing status values are preserved.

ALTER TABLE `purchase_orders`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'SENT_BACK',
    'SENT_TO_VENDOR',
    'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED',
    'PARTIALLY_INVOICED',
    'FULLY_INVOICED',
    'CANCELLED',
    'CLOSED'
  ) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `rejectedAt` DATETIME(3) NULL,
  ADD COLUMN `rejectionReason` TEXT NULL,
  ADD COLUMN `sentBackAt` DATETIME(3) NULL,
  ADD COLUMN `sendBackReason` TEXT NULL;

ALTER TABLE `purchase_order_lines`
  ADD COLUMN `acceptedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `rejectedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `returnedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `invoicedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;
