-- PR line → PO track record (filled automatically on Planning→PO / RFQ→PO)
ALTER TABLE `purchase_requisition_lines`
  ADD COLUMN `purchaseOrderId` VARCHAR(191) NULL,
  ADD COLUMN `purchaseOrderNumberSnapshot` VARCHAR(64) NULL;

CREATE INDEX `purchase_requisition_lines_tenantId_purchaseOrderId_idx`
  ON `purchase_requisition_lines`(`tenantId`, `purchaseOrderId`);

ALTER TABLE `purchase_requisition_lines`
  ADD CONSTRAINT `purchase_requisition_lines_purchaseOrderId_fkey`
  FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
