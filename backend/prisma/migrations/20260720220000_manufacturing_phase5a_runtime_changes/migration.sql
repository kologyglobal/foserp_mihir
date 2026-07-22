-- Manufacturing Phase 5A — Runtime change requests + configurable approval rules.
-- Additive only. Manufacturing-local approval (not FinanceApprovalDocumentType).
-- Index/constraint names kept ≤64 chars for MySQL/MariaDB.

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE'
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
  'STAGE_HELD', 'STAGE_RESUMED'
) NOT NULL;

CREATE TABLE `manufacturing_runtime_change_rules` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `changeType` ENUM(
    'QUANTITY_CHANGE', 'DUE_DATE_CHANGE', 'PRIORITY_CHANGE', 'SUPERVISOR_CHANGE',
    'OPERATOR_CHANGE', 'MACHINE_CHANGE', 'WORK_CENTRE_CHANGE', 'ADD_OPERATION',
    'REPEAT_OPERATION', 'SKIP_OPERATION', 'CONVERT_TO_JOB_WORK', 'WORK_ORDER_HOLD',
    'WORK_ORDER_RESUME', 'STAGE_HOLD', 'STAGE_RESUME'
  ) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `approvalRequired` BOOLEAN NOT NULL,
  `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  `configJson` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfg_rc_rules_tenant_type_name_key` (`tenantId`,`changeType`,`name`),
  INDEX `mfg_rc_rules_tenant_idx` (`tenantId`),
  INDEX `mfg_runtime_change_rules_tenant_type_active_idx` (`tenantId`,`changeType`,`isActive`),
  CONSTRAINT `mfg_rc_rules_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
);

CREATE TABLE `production_runtime_changes` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `changeNumber` VARCHAR(64) NOT NULL,
  `productionOrderId` VARCHAR(191) NOT NULL,
  `stageId` VARCHAR(191) NULL,
  `operationId` VARCHAR(191) NULL,
  `assignmentId` VARCHAR(191) NULL,
  `jobWorkOrderId` VARCHAR(191) NULL,
  `changeType` ENUM(
    'QUANTITY_CHANGE', 'DUE_DATE_CHANGE', 'PRIORITY_CHANGE', 'SUPERVISOR_CHANGE',
    'OPERATOR_CHANGE', 'MACHINE_CHANGE', 'WORK_CENTRE_CHANGE', 'ADD_OPERATION',
    'REPEAT_OPERATION', 'SKIP_OPERATION', 'CONVERT_TO_JOB_WORK', 'WORK_ORDER_HOLD',
    'WORK_ORDER_RESUME', 'STAGE_HOLD', 'STAGE_RESUME'
  ) NOT NULL,
  `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
  `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
  `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
  `approvalRuleId` VARCHAR(191) NULL,
  `requestedBy` VARCHAR(191) NULL,
  `requestedAt` DATETIME(3) NULL,
  `reason` TEXT NOT NULL,
  `businessJustification` TEXT NULL,
  `effectiveDate` DATETIME(3) NULL,
  `originalValueJson` JSON NOT NULL,
  `proposedValueJson` JSON NOT NULL,
  `approvedValueJson` JSON NULL,
  `impactSummaryJson` JSON NULL,
  `validationSummaryJson` JSON NULL,
  `approvedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `appliedBy` VARCHAR(191) NULL,
  `appliedAt` DATETIME(3) NULL,
  `applicationReference` VARCHAR(150) NULL,
  `failureReason` TEXT NULL,
  `orderUpdatedAtAtRequest` DATETIME(3) NULL,
  `idempotencyKey` VARCHAR(150) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `prod_rc_tenant_number_key` (`tenantId`,`changeNumber`),
  UNIQUE INDEX `prod_rc_tenant_idem_key` (`tenantId`,`idempotencyKey`),
  INDEX `prod_rc_tenant_idx` (`tenantId`),
  INDEX `prod_rc_tenant_order_idx` (`tenantId`,`productionOrderId`),
  INDEX `prod_rc_tenant_status_idx` (`tenantId`,`status`),
  INDEX `prod_rc_tenant_type_idx` (`tenantId`,`changeType`),
  INDEX `prod_rc_tenant_deleted_idx` (`tenantId`,`deletedAt`),
  CONSTRAINT `prod_rc_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `prod_rc_order_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`),
  CONSTRAINT `prod_rc_stage_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages` (`id`),
  CONSTRAINT `prod_rc_op_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations` (`id`),
  CONSTRAINT `prod_rc_assign_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `production_assignments` (`id`),
  CONSTRAINT `prod_rc_jw_fkey` FOREIGN KEY (`jobWorkOrderId`) REFERENCES `job_work_orders` (`id`),
  CONSTRAINT `prod_rc_rule_fkey` FOREIGN KEY (`approvalRuleId`) REFERENCES `manufacturing_runtime_change_rules` (`id`)
);
