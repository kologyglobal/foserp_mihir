-- Phase 7C5 — immutable DispatchPosting / DispatchReversal ledger (not a second stock ledger).

ALTER TABLE `code_series`
  MODIFY COLUMN `entityType` ENUM(
    'USER','LEAD','CONTACT','CRM_COMPANY','OPPORTUNITY','QUOTATION','SALES_ORDER',
    'PRODUCTION_DEMAND','PRODUCTION_ORDER','DAILY_PRODUCTION_BATCH','PRODUCTION_ISSUE',
    'STOCK_MOVEMENT','STOCK_RESERVATION','PURCHASE_REQUISITION','PURCHASE_PLANNING',
    'REQUEST_FOR_QUOTATION','VENDOR_QUOTATION','VENDOR_COMPARISON','PURCHASE_ORDER',
    'GOODS_RECEIPT','QUALITY_INSPECTION','QUALITY_NCR','PURCHASE_INVOICE','PURCHASE_RETURN',
    'JOB_WORK_ORDER','PRODUCTION_RUNTIME_CHANGE','PRODUCTION_WIP_MOVEMENT','MANUFACTURING_CORRECTION',
    'PRODUCTION_PLAN','DEMAND_CONSOLIDATION_PLAN','OUTBOUND_DISPATCH','PRODUCTION_FG_RECEIPT',
    'DISPATCH_REQUIREMENT','DISPATCH_PICK_LIST','DISPATCH_PACKING_SESSION','DISPATCH_PACKAGE',
    'DELIVERY_CHALLAN','PURCHASE_QUALITY_INSPECTION','INVENTORY_TRANSFER','INVENTORY_STOCK_COUNT',
    'INVENTORY_ADJUSTMENT','MANUFACTURING_ROUTING','DISPATCH_POSTING','DISPATCH_REVERSAL'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS `dispatch_postings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `postingNumber` VARCHAR(64) NOT NULL,
  `outboundDispatchId` VARCHAR(191) NOT NULL,
  `salesOrderId` VARCHAR(191) NULL,
  `status` ENUM('POSTED','PARTIALLY_REVERSED','REVERSED','LEGACY_POSTED') NOT NULL DEFAULT 'POSTED',
  `postingDate` DATE NOT NULL,
  `mode` VARCHAR(16) NOT NULL DEFAULT 'post',
  `policySnapshot` JSON NULL,
  `idempotencyKey` VARCHAR(150) NULL,
  `requestFingerprint` VARCHAR(128) NULL,
  `postedBy` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reversedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `deliveryChallanId` VARCHAR(191) NULL,
  `pickListId` VARCHAR(191) NULL,
  `packingSessionId` VARCHAR(191) NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_posting_tenant_number_uidx`(`tenantId`, `postingNumber`),
  UNIQUE INDEX `dispatch_posting_tenant_idem_uidx`(`tenantId`, `idempotencyKey`),
  UNIQUE INDEX `dispatch_posting_tenant_outbound_uidx`(`tenantId`, `outboundDispatchId`),
  INDEX `dispatch_posting_tenant_status_idx`(`tenantId`, `status`),
  INDEX `dispatch_posting_tenant_so_idx`(`tenantId`, `salesOrderId`),
  INDEX `dispatch_posting_tenant_fp_idx`(`tenantId`, `requestFingerprint`),
  CONSTRAINT `dispatch_postings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_postings_outboundDispatchId_fkey` FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dispatch_posting_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `postingId` VARCHAR(191) NOT NULL,
  `lineNo` INT NOT NULL,
  `outboundDispatchLineId` VARCHAR(191) NOT NULL,
  `salesOrderId` VARCHAR(191) NULL,
  `salesOrderLineId` VARCHAR(64) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `uomId` VARCHAR(191) NULL,
  `inventoryMovementId` VARCHAR(191) NULL,
  `inventoryMovementNo` VARCHAR(64) NULL,
  `reservationConsumedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `pickListId` VARCHAR(191) NULL,
  `pickLineId` VARCHAR(191) NULL,
  `packingSessionId` VARCHAR(191) NULL,
  `packageLineId` VARCHAR(191) NULL,
  `challanId` VARCHAR(191) NULL,
  `challanLineId` VARCHAR(191) NULL,
  `serialLotSnapshotJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_posting_line_no_uidx`(`postingId`, `lineNo`),
  UNIQUE INDEX `dispatch_posting_line_mov_uidx`(`tenantId`, `inventoryMovementId`),
  INDEX `dispatch_posting_line_tenant_post_idx`(`tenantId`, `postingId`),
  INDEX `dispatch_posting_line_ob_line_idx`(`tenantId`, `outboundDispatchLineId`),
  INDEX `dispatch_posting_line_so_line_idx`(`tenantId`, `salesOrderId`, `salesOrderLineId`),
  CONSTRAINT `dispatch_posting_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_posting_lines_postingId_fkey` FOREIGN KEY (`postingId`) REFERENCES `dispatch_postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dispatch_reversals` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `reversalNumber` VARCHAR(64) NOT NULL,
  `originalPostingId` VARCHAR(191) NOT NULL,
  `outboundDispatchId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT_REQUEST','SUBMITTED','APPROVED','APPLIED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT_REQUEST',
  `reasonCode` VARCHAR(64) NULL,
  `reason` TEXT NULL,
  `requestedBy` VARCHAR(191) NULL,
  `requestedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `appliedBy` VARCHAR(191) NULL,
  `appliedAt` DATETIME(3) NULL,
  `effectiveDate` DATE NOT NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `idempotencyKey` VARCHAR(150) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `dispatch_reversal_tenant_number_uidx`(`tenantId`, `reversalNumber`),
  UNIQUE INDEX `dispatch_reversal_tenant_idem_uidx`(`tenantId`, `idempotencyKey`),
  INDEX `dispatch_reversal_tenant_post_idx`(`tenantId`, `originalPostingId`),
  INDEX `dispatch_reversal_tenant_ob_idx`(`tenantId`, `outboundDispatchId`),
  INDEX `dispatch_reversal_tenant_status_idx`(`tenantId`, `status`),
  CONSTRAINT `dispatch_reversals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_reversals_originalPostingId_fkey` FOREIGN KEY (`originalPostingId`) REFERENCES `dispatch_postings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dispatch_reversal_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `reversalId` VARCHAR(191) NOT NULL,
  `originalPostingLineId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `inventoryMovementId` VARCHAR(191) NULL,
  `inventoryMovementNo` VARCHAR(64) NULL,
  `serialLotSnapshotJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `dispatch_reversal_line_tenant_rev_idx`(`tenantId`, `reversalId`),
  INDEX `dispatch_reversal_line_post_line_idx`(`tenantId`, `originalPostingLineId`),
  UNIQUE INDEX `dispatch_reversal_line_mov_uidx`(`tenantId`, `inventoryMovementId`),
  CONSTRAINT `dispatch_reversal_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `dispatch_reversal_lines_reversalId_fkey` FOREIGN KEY (`reversalId`) REFERENCES `dispatch_reversals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dispatch_reversal_lines_originalPostingLineId_fkey` FOREIGN KEY (`originalPostingLineId`) REFERENCES `dispatch_posting_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill LEGACY_POSTED rows for historical CONFIRMED / REVERSED outbounds (immutable snapshot).
INSERT INTO `dispatch_postings` (
  `id`, `tenantId`, `postingNumber`, `outboundDispatchId`, `salesOrderId`, `status`,
  `postingDate`, `mode`, `postedBy`, `postedAt`, `reversedQuantity`, `remarks`, `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  d.`tenantId`,
  CONCAT('LEG-', d.`dispatchNo`),
  d.`id`,
  d.`salesOrderId`,
  CASE WHEN d.`status` = 'REVERSED' THEN 'REVERSED' ELSE 'LEGACY_POSTED' END,
  DATE(COALESCE(d.`confirmedAt`, d.`createdAt`)),
  'legacy',
  d.`confirmedBy`,
  COALESCE(d.`confirmedAt`, d.`createdAt`),
  CASE WHEN d.`status` = 'REVERSED' THEN (
    SELECT COALESCE(SUM(l.`quantity`), 0) FROM `outbound_dispatch_lines` l WHERE l.`outboundDispatchId` = d.`id`
  ) ELSE 0 END,
  'Backfilled from historical outbound (pre–DispatchPosting table)',
  NOW(3),
  NOW(3)
FROM `outbound_dispatches` d
WHERE d.`deletedAt` IS NULL
  AND d.`status` IN ('CONFIRMED', 'REVERSED')
  AND NOT EXISTS (
    SELECT 1 FROM `dispatch_postings` p
    WHERE p.`tenantId` = d.`tenantId` AND p.`outboundDispatchId` = d.`id`
  );

INSERT INTO `dispatch_posting_lines` (
  `id`, `tenantId`, `postingId`, `lineNo`, `outboundDispatchLineId`, `salesOrderId`, `salesOrderLineId`,
  `itemId`, `warehouseId`, `quantity`, `inventoryMovementId`, `inventoryMovementNo`,
  `reservationConsumedQty`, `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  l.`tenantId`,
  p.`id`,
  l.`lineNo`,
  l.`id`,
  l.`salesOrderId`,
  l.`salesOrderLineId`,
  l.`itemId`,
  l.`warehouseId`,
  l.`quantity`,
  l.`inventoryMovementId`,
  l.`inventoryMovementNo`,
  CASE WHEN l.`inventoryMovementId` IS NOT NULL THEN l.`quantity` ELSE 0 END,
  NOW(3),
  NOW(3)
FROM `outbound_dispatch_lines` l
INNER JOIN `dispatch_postings` p
  ON p.`outboundDispatchId` = l.`outboundDispatchId` AND p.`tenantId` = l.`tenantId`
WHERE p.`mode` = 'legacy'
  AND NOT EXISTS (
    SELECT 1 FROM `dispatch_posting_lines` pl
    WHERE pl.`postingId` = p.`id` AND pl.`outboundDispatchLineId` = l.`id`
  );
