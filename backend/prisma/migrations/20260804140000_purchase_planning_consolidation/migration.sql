-- Purchase Planning Consolidation: setup flag + PO line -> PR source audit links
-- Index names shortened for MySQL 64-char identifier limit.
ALTER TABLE `purchase_settings`
  ADD COLUMN `planningConsolidationEnabled` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `purchase_order_line_pr_sources` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `purchaseOrderLineId` VARCHAR(191) NOT NULL,
  `purchaseRequisitionId` VARCHAR(191) NOT NULL,
  `purchaseRequisitionLineId` VARCHAR(191) NOT NULL,
  `purchasePlanningRowId` VARCHAR(191) NULL,
  `requisitionNumber` VARCHAR(64) NOT NULL DEFAULT '',
  `planningNumber` VARCHAR(64) NULL,
  `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `pol_pr_src_tenant_idx`(`tenantId`),
  INDEX `pol_pr_src_tenant_pol_idx`(`tenantId`, `purchaseOrderLineId`),
  INDEX `pol_pr_src_tenant_pr_idx`(`tenantId`, `purchaseRequisitionId`),
  INDEX `pol_pr_src_tenant_prl_idx`(`tenantId`, `purchaseRequisitionLineId`),
  INDEX `pol_pr_src_tenant_plan_idx`(`tenantId`, `purchasePlanningRowId`),
  CONSTRAINT `purchase_order_line_pr_sources_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_line_pr_sources_purchaseOrderLineId_fkey`
    FOREIGN KEY (`purchaseOrderLineId`) REFERENCES `purchase_order_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_line_pr_sources_purchaseRequisitionId_fkey`
    FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_line_pr_sources_purchaseRequisitionLineId_fkey`
    FOREIGN KEY (`purchaseRequisitionLineId`) REFERENCES `purchase_requisition_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_line_pr_sources_purchasePlanningRowId_fkey`
    FOREIGN KEY (`purchasePlanningRowId`) REFERENCES `purchase_planning_rows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;