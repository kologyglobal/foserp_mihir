-- Proof of Delivery (POD) — logistics confirmation only; does not move stock.
-- Stock already issued at Dispatch post (FG_DISPATCH).

CREATE TABLE `dispatch_proofs_of_delivery` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `outboundDispatchId` VARCHAR(191) NOT NULL,
  `deliveryChallanId` VARCHAR(191) NULL,
  `salesOrderId` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NULL,
  `status` ENUM('IN_TRANSIT', 'DELIVERED', 'PARTIALLY_DELIVERED', 'DELIVERY_EXCEPTION', 'REJECTED_BY_CUSTOMER', 'RETURN_INITIATED') NOT NULL DEFAULT 'IN_TRANSIT',
  `deliveryAddress` TEXT NULL,
  `deliveredAt` DATETIME(3) NULL,
  `receiverName` VARCHAR(200) NULL,
  `receiverContact` VARCHAR(64) NULL,
  `signatureStorageKey` VARCHAR(500) NULL,
  `quantityDelivered` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `quantityDamaged` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `quantityShort` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `deliveryRemarks` TEXT NULL,
  `transporterRemarks` TEXT NULL,
  `exceptionCode` VARCHAR(64) NULL,
  `exceptionNotes` TEXT NULL,
  `gpsLatitude` DECIMAL(10, 7) NULL,
  `gpsLongitude` DECIMAL(10, 7) NULL,
  `inTransitAt` DATETIME(3) NULL,
  `inTransitBy` VARCHAR(191) NULL,
  `capturedAt` DATETIME(3) NULL,
  `capturedBy` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `dsp_pod_tenant_ob_uidx`(`tenantId`, `outboundDispatchId`),
  INDEX `dsp_pod_tenant_status_idx`(`tenantId`, `status`),
  INDEX `dsp_pod_tenant_so_idx`(`tenantId`, `salesOrderId`),
  CONSTRAINT `dsp_pod_ob_fkey` FOREIGN KEY (`outboundDispatchId`) REFERENCES `outbound_dispatches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dsp_pod_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispatch_pod_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `proofOfDeliveryId` VARCHAR(191) NOT NULL,
  `outboundDispatchLineId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `dispatchedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `deliveredQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `damagedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `shortQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `remarks` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `dsp_pod_line_pod_obline_uidx`(`proofOfDeliveryId`, `outboundDispatchLineId`),
  INDEX `dsp_pod_line_tenant_idx`(`tenantId`),
  CONSTRAINT `dsp_pod_line_pod_fkey` FOREIGN KEY (`proofOfDeliveryId`) REFERENCES `dispatch_proofs_of_delivery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dsp_pod_line_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispatch_pod_attachments` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `proofOfDeliveryId` VARCHAR(191) NOT NULL,
  `kind` ENUM('SIGNATURE', 'PHOTO', 'STAMPED_INVOICE', 'SIGNED_CHALLAN', 'TRANSPORTER_CONFIRMATION', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `fileName` VARCHAR(255) NOT NULL,
  `storageKey` VARCHAR(500) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `byteSize` INT NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `dsp_pod_att_pod_idx`(`proofOfDeliveryId`),
  INDEX `dsp_pod_att_tenant_idx`(`tenantId`),
  CONSTRAINT `dsp_pod_att_pod_fkey` FOREIGN KEY (`proofOfDeliveryId`) REFERENCES `dispatch_proofs_of_delivery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dsp_pod_att_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `outbound_dispatches`
  ADD COLUMN `deliveryStatus` ENUM('IN_TRANSIT', 'DELIVERED', 'PARTIALLY_DELIVERED', 'DELIVERY_EXCEPTION', 'REJECTED_BY_CUSTOMER', 'RETURN_INITIATED') NULL;
