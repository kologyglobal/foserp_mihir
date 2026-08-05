-- QC inspection evidence photos (mobile / kiosk upload)
CREATE TABLE IF NOT EXISTS `quality_inspection_photos` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `inspectionId` VARCHAR(191) NOT NULL,
  `originalFilename` VARCHAR(255) NOT NULL,
  `storedFilename` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `fileSize` INT NOT NULL,
  `storagePath` VARCHAR(500) NOT NULL,
  `caption` VARCHAR(500) NULL,
  `uploadedBy` VARCHAR(191) NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `quality_inspection_photos_tenantId_idx` (`tenantId`),
  INDEX `quality_inspection_photos_tenantId_inspectionId_idx` (`tenantId`, `inspectionId`),
  CONSTRAINT `quality_inspection_photos_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `quality_inspection_photos_inspectionId_fkey`
    FOREIGN KEY (`inspectionId`) REFERENCES `mfg_quality_inspections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
