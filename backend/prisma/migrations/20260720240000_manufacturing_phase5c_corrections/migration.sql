-- Manufacturing Phase 5C — Corrections / reversals framework.
-- Additive only. Compensating transactions; no rewrite of posted ledgers.

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT', 'MANUFACTURING_CORRECTION'
) NOT NULL;

ALTER TABLE `production_activities` MODIFY COLUMN `activityType` ENUM(
  'CREATED', 'DEMAND_CREATED', 'DEMAND_CONVERTED', 'RELEASED', 'STARTED', 'HELD', 'RESUMED',
  'STAGE_READY', 'STAGE_STARTED', 'PROGRESS_RECORDED', 'STAGE_COMPLETED', 'COMPLETED',
  'CANCELLED', 'CORRECTION', 'ASSIGNED', 'DUE_DATE_CHANGED', 'PRIORITY_CHANGED',
  'OPERATOR_ASSIGNED', 'MACHINE_ASSIGNED', 'WORK_REASSIGNED', 'ASSIGNMENT_CANCELLED',
  'ASSIGNMENT_ACCEPTED', 'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_COMPLETED',
  'DAILY_PRODUCTION_SUBMITTED', 'DAILY_PRODUCTION_CORRECTED', 'ISSUE_REPORTED',
  'ISSUE_ACKNOWLEDGED', 'ISSUE_RESOLVED', 'ISSUE_CANCELLED', 'DOWNTIME_STARTED',
  'DOWNTIME_ENDED', 'QC_REQUESTED', 'QC_PASSED', 'QC_REWORK', 'QC_REJECTED', 'NCR_OPENED',
  'NCR_CLOSED', 'RUNTIME_CHANGE_REQUESTED', 'RUNTIME_CHANGE_APPROVED',
  'RUNTIME_CHANGE_REJECTED', 'RUNTIME_CHANGE_APPLIED', 'RUNTIME_CHANGE_FAILED',
  'STAGE_HELD', 'STAGE_RESUMED', 'WIP_MOVED', 'MATERIAL_TRANSFERRED', 'WO_TO_WO_TRANSFERRED',
  'CORRECTION_REQUESTED', 'CORRECTION_APPROVED', 'CORRECTION_REJECTED', 'CORRECTION_APPLIED',
  'CORRECTION_FAILED', 'TRANSACTION_REVERSED', 'TRANSACTION_REPLACED'
) NOT NULL;

CREATE TABLE `manufacturing_transaction_corrections` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `correctionNumber` VARCHAR(64) NOT NULL,
  `transactionType` ENUM(
    'PRODUCTION_PROGRESS', 'DAILY_PRODUCTION_LINE', 'DAILY_PRODUCTION_BATCH',
    'MATERIAL_ISSUE', 'MATERIAL_RETURN', 'ADDITIONAL_MATERIAL_ISSUE',
    'MATERIAL_TRANSFER', 'RESERVATION_TRANSFER', 'WIP_MOVEMENT', 'FG_RECEIPT',
    'JOB_WORK_DISPATCH', 'JOB_WORK_RECEIPT', 'JOB_WORK_RETURN', 'JOB_WORK_RECONCILIATION',
    'WORK_ORDER_SPLIT', 'QUALITY_DECISION'
  ) NOT NULL,
  `correctionType` ENUM(
    'REVERSE_ONLY', 'REVERSE_AND_REPLACE', 'QUANTITY_CORRECTION', 'DATE_CORRECTION',
    'REFERENCE_CORRECTION', 'FULL_BATCH_REVERSAL', 'PARTIAL_REVERSAL', 'SUPERSEDE_DECISION'
  ) NOT NULL,
  `status` ENUM(
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLYING', 'APPLIED', 'FAILED', 'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `sourceEntityType` VARCHAR(64) NOT NULL,
  `sourceEntityId` VARCHAR(191) NOT NULL,
  `sourceTransactionId` VARCHAR(191) NULL,
  `productionOrderId` VARCHAR(191) NULL,
  `stageId` VARCHAR(191) NULL,
  `operationId` VARCHAR(191) NULL,
  `inventoryMovementId` VARCHAR(191) NULL,
  `productionLedgerId` VARCHAR(191) NULL,
  `jobWorkOrderId` VARCHAR(191) NULL,
  `qualityInspectionId` VARCHAR(191) NULL,
  `wipMovementId` VARCHAR(191) NULL,
  `dailyProductionBatchId` VARCHAR(191) NULL,
  `dailyProductionLineId` VARCHAR(191) NULL,
  `materialLineId` VARCHAR(191) NULL,
  `requestedAction` VARCHAR(64) NOT NULL,
  `requestedValuesJson` JSON NULL,
  `originalValuesJson` JSON NOT NULL,
  `impactSummaryJson` JSON NULL,
  `dependencySummaryJson` JSON NULL,
  `validationSummaryJson` JSON NULL,
  `reason` TEXT NOT NULL,
  `businessJustification` TEXT NULL,
  `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
  `previewToken` VARCHAR(150) NULL,
  `sourceVersion` VARCHAR(150) NULL,
  `requestedBy` VARCHAR(191) NULL,
  `requestedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `appliedBy` VARCHAR(191) NULL,
  `appliedAt` DATETIME(3) NULL,
  `reversalTransactionId` VARCHAR(191) NULL,
  `replacementTransactionId` VARCHAR(191) NULL,
  `failureReason` TEXT NULL,
  `idempotencyKey` VARCHAR(150) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfg_corr_tenant_num_key` (`tenantId`, `correctionNumber`),
  UNIQUE INDEX `mfg_corr_tenant_idem_key` (`tenantId`, `idempotencyKey`),
  INDEX `mfg_corr_tenant_idx` (`tenantId`),
  INDEX `mfg_corr_tenant_status_idx` (`tenantId`, `status`),
  INDEX `mfg_corr_tenant_type_idx` (`tenantId`, `transactionType`),
  INDEX `mfg_corr_tenant_wo_idx` (`tenantId`, `productionOrderId`),
  INDEX `mfg_corr_tenant_src_idx` (`tenantId`, `sourceEntityType`, `sourceEntityId`),
  INDEX `mfg_corr_tenant_del_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `mfg_corr_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_corr_wo_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `manufacturing_transaction_reversal_links` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `correctionId` VARCHAR(191) NOT NULL,
  `sourceEntityType` VARCHAR(64) NOT NULL,
  `sourceEntityId` VARCHAR(191) NOT NULL,
  `reversalEntityType` VARCHAR(64) NOT NULL,
  `reversalEntityId` VARCHAR(191) NOT NULL,
  `replacementEntityType` VARCHAR(64) NULL,
  `replacementEntityId` VARCHAR(191) NULL,
  `quantityReversed` DECIMAL(18, 4) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfg_rev_link_uniq` (`tenantId`, `correctionId`, `reversalEntityType`, `reversalEntityId`),
  INDEX `mfg_rev_link_tenant_idx` (`tenantId`),
  INDEX `mfg_rev_link_corr_idx` (`tenantId`, `correctionId`),
  INDEX `mfg_rev_link_src_idx` (`tenantId`, `sourceEntityType`, `sourceEntityId`),
  CONSTRAINT `mfg_rev_link_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `mfg_rev_link_corr_fkey` FOREIGN KEY (`correctionId`) REFERENCES `manufacturing_transaction_corrections` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
