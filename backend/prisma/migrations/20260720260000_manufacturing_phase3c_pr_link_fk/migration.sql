-- Manufacturing Phase 3C follow-up: FK from production_order_materials.purchaseRequisitionId
-- to purchase_requisitions. Split out of 20260720190000_manufacturing_phase3c_materials because
-- purchase_requisitions is created in 20260720120000_add_purchase_requisition_planning_rfq.
-- Conditional so databases that already have the FK (applied via the original 3C file) are a no-op.

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_order_materials'
    AND CONSTRAINT_NAME = 'production_order_materials_purchaseRequisitionId_fkey'
);

SET @ddl := IF(
  @fk_exists = 0,
  'ALTER TABLE `production_order_materials` ADD CONSTRAINT `production_order_materials_purchaseRequisitionId_fkey` FOREIGN KEY (`purchaseRequisitionId`) REFERENCES `purchase_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
