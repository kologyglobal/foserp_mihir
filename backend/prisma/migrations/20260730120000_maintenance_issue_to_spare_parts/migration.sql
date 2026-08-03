-- Maintenance spare-parts Inventory ISSUE posting
-- 1) InventoryReferenceType += ISSUE_TO_MAINTENANCE
-- 2) maintenance_parts.warehouseId for issue warehouse audit
-- 3) inventoryPostingPending default false (pending only when stockable parts lack movement)

ALTER TABLE `inventory_stock_movements`
  MODIFY COLUMN `referenceType` ENUM(
    'OPN',
    'INW',
    'ISS',
    'ADJ',
    'GRN',
    'ISSUE_TO_WO',
    'RETURN_FROM_WO',
    'WIP_RECEIVE',
    'WIP_TRANSFER',
    'MOVE_TO_WIP',
    'MOVE_FROM_WIP',
    'SA_RECEIPT',
    'FG_RECEIPT',
    'DISPATCH',
    'FG_DISPATCH',
    'SUBCON_OUT',
    'SUBCON_IN',
    'QUALITY_RELEASE',
    'QUALITY_HOLD',
    'QUALITY_REJECT',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT',
    'TRANSFER_REVERSAL',
    'STOCK_COUNT',
    'STOCK_COUNT_REVERSAL',
    'CONTROLLED_ADJUSTMENT',
    'ADJUSTMENT_REVERSAL',
    'ISSUE_TO_MAINTENANCE'
  ) NOT NULL;

ALTER TABLE `inventory_serials`
  MODIFY COLUMN `sourceReferenceType` ENUM(
    'OPN',
    'INW',
    'ISS',
    'ADJ',
    'GRN',
    'ISSUE_TO_WO',
    'RETURN_FROM_WO',
    'WIP_RECEIVE',
    'WIP_TRANSFER',
    'MOVE_TO_WIP',
    'MOVE_FROM_WIP',
    'SA_RECEIPT',
    'FG_RECEIPT',
    'DISPATCH',
    'FG_DISPATCH',
    'SUBCON_OUT',
    'SUBCON_IN',
    'QUALITY_RELEASE',
    'QUALITY_HOLD',
    'QUALITY_REJECT',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT',
    'TRANSFER_REVERSAL',
    'STOCK_COUNT',
    'STOCK_COUNT_REVERSAL',
    'CONTROLLED_ADJUSTMENT',
    'ADJUSTMENT_REVERSAL',
    'ISSUE_TO_MAINTENANCE'
  ) NULL;

ALTER TABLE `maintenance_parts`
  ADD COLUMN `warehouseId` VARCHAR(191) NULL,
  ADD INDEX `maintenance_parts_tenantId_warehouseId_idx`(`tenantId`, `warehouseId`);

ALTER TABLE `maintenance_parts`
  ADD CONSTRAINT `maintenance_parts_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `master_warehouses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_tickets`
  MODIFY COLUMN `inventoryPostingPending` BOOLEAN NOT NULL DEFAULT false;
