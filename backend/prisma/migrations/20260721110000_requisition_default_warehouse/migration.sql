-- Requisition Setup: default warehouse pre-selected on new Purchase Requisitions

ALTER TABLE `purchase_settings`
    ADD COLUMN `defaultRequisitionWarehouseId` VARCHAR(191) NULL;

ALTER TABLE `purchase_settings`
    ADD CONSTRAINT `purchase_settings_defaultRequisitionWarehouseId_fkey`
        FOREIGN KEY (`defaultRequisitionWarehouseId`) REFERENCES `master_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
