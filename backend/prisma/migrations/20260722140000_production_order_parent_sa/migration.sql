-- Parent FG ↔ child SA work-order tree (Tank SA family / multilevel BOM explode).
ALTER TABLE `production_orders`
  ADD COLUMN `parentProductionOrderId` VARCHAR(191) NULL;

CREATE INDEX `production_orders_tenantId_parentProductionOrderId_idx`
  ON `production_orders`(`tenantId`, `parentProductionOrderId`);

ALTER TABLE `production_orders`
  ADD CONSTRAINT `production_orders_parentProductionOrderId_fkey`
  FOREIGN KEY (`parentProductionOrderId`) REFERENCES `production_orders`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
