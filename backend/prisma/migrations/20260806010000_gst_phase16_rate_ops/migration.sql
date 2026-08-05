-- Phase 16 — GST rate master ops / determination continuity evidence runs.
-- Not portal filing · not FULL GST COMPLIANT · does not alter MasterGstRate / posted tax.
-- Ordered after Phase 12–15 GST migrations; additive only.

CREATE TABLE IF NOT EXISTS `gst_rate_ops_runs` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `returnPeriod` VARCHAR(7) NOT NULL,
  `asOfDate` DATE NOT NULL,
  `runKind` ENUM('COVERAGE', 'DRIFT', 'FULL_REPORT') NOT NULL DEFAULT 'FULL_REPORT',
  `status` ENUM('GENERATED', 'ACKNOWLEDGED', 'VOID') NOT NULL DEFAULT 'GENERATED',
  `gapCount` INT NOT NULL DEFAULT 0,
  `expiringCount` INT NOT NULL DEFAULT 0,
  `overlapCount` INT NOT NULL DEFAULT 0,
  `driftCount` INT NOT NULL DEFAULT 0,
  `scorePct` INT NOT NULL DEFAULT 0,
  `overall` VARCHAR(32) NOT NULL,
  `reportJson` JSON NOT NULL,
  `notes` VARCHAR(1000) NULL,
  `generatedBy` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `acknowledgedAt` DATETIME(3) NULL,
  `acknowledgedBy` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gst_rate_ops_le_period_idx`(`tenantId`, `legalEntityId`, `returnPeriod`),
  INDEX `gst_rate_ops_status_idx`(`tenantId`, `status`),
  CONSTRAINT `gst_rate_ops_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_rate_ops_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
