-- Manufacturing Phase 5B — Material / WIP / WO transfers (ProductionWipMovement).
-- Additive only. Inventory remains physical SoT. Short index names for MySQL.

ALTER TABLE `code_series` MODIFY COLUMN `entityType` ENUM(
  'USER', 'LEAD', 'CONTACT', 'CRM_COMPANY', 'OPPORTUNITY', 'QUOTATION', 'SALES_ORDER',
  'PRODUCTION_DEMAND', 'PRODUCTION_ORDER', 'DAILY_PRODUCTION_BATCH', 'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT', 'STOCK_RESERVATION', 'PURCHASE_REQUISITION',
  'QUALITY_INSPECTION', 'QUALITY_NCR', 'JOB_WORK_ORDER', 'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT'
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
  'STAGE_HELD', 'STAGE_RESUMED', 'WIP_MOVED', 'MATERIAL_TRANSFERRED', 'WO_TO_WO_TRANSFERRED'
) NOT NULL;

CREATE TABLE `production_wip_movements` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `movementNumber` VARCHAR(64) NOT NULL,
  `movementType` ENUM('LOCATION_WIP', 'MATERIAL_RELOCATE', 'WO_TO_WO') NOT NULL,
  `status` ENUM('DRAFT', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
  `productionOrderId` VARCHAR(191) NOT NULL,
  `targetProductionOrderId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `uomId` VARCHAR(191) NULL,
  `fromWarehouseId` VARCHAR(191) NOT NULL,
  `toWarehouseId` VARCHAR(191) NOT NULL,
  `stageId` VARCHAR(191) NULL,
  `operationId` VARCHAR(191) NULL,
  `materialLineId` VARCHAR(191) NULL,
  `reason` TEXT NOT NULL,
  `remarks` TEXT NULL,
  `physicalPosted` BOOLEAN NOT NULL DEFAULT false,
  `outboundMovementId` VARCHAR(191) NULL,
  `inboundMovementId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(150) NULL,
  `postedBy` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `production_wip_movements_tenantId_movementNumber_key` (`tenantId`, `movementNumber`),
  UNIQUE INDEX `production_wip_movements_tenantId_idempotencyKey_key` (`tenantId`, `idempotencyKey`),
  INDEX `prod_wip_move_tenant_idx` (`tenantId`),
  INDEX `prod_wip_move_tenant_wo_idx` (`tenantId`, `productionOrderId`),
  INDEX `prod_wip_move_tenant_tgt_idx` (`tenantId`, `targetProductionOrderId`),
  INDEX `prod_wip_move_tenant_status_idx` (`tenantId`, `status`),
  INDEX `prod_wip_move_tenant_del_idx` (`tenantId`, `deletedAt`),
  CONSTRAINT `prod_wip_move_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_src_wo_fkey` FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_tgt_wo_fkey` FOREIGN KEY (`targetProductionOrderId`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_item_fkey` FOREIGN KEY (`itemId`) REFERENCES `master_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_uom_fkey` FOREIGN KEY (`uomId`) REFERENCES `master_uoms` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_from_wh_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_to_wh_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `master_warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_stage_fkey` FOREIGN KEY (`stageId`) REFERENCES `production_order_stages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_op_fkey` FOREIGN KEY (`operationId`) REFERENCES `production_order_operations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `prod_wip_move_mat_fkey` FOREIGN KEY (`materialLineId`) REFERENCES `production_order_materials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
