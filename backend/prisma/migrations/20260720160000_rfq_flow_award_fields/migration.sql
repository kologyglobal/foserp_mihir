-- RFQ flow: code series + quotation commercial fields + award audit fields
ALTER TABLE `code_series`
  MODIFY COLUMN `entityType` ENUM(
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
    'PURCHASE_ORDER'
  ) NOT NULL;

ALTER TABLE `vendor_quotations`
  ADD COLUMN `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `otherCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `landedCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `warranty` VARCHAR(300) NULL;

ALTER TABLE `vendor_comparisons`
  ADD COLUMN `selectionReason` TEXT NULL,
  ADD COLUMN `awardedById` VARCHAR(36) NULL;
