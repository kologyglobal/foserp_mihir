-- Phase 13 — GST go-live / statutory UAT gate + period books readiness.
-- Ordered after Phase 12 portal filing foundation (`20260805240000`).
-- Does NOT recreate notices / multi-period audit packs (Phase 15) or GSTR-9 worksheets (Phase 14).
-- Not LIVE GSTN certification · not FULL GST COMPLIANT.

CREATE TABLE IF NOT EXISTS `gst_compliance_uat_signoffs` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `legalEntityId` VARCHAR(191) NOT NULL,
  `companyGstin` VARCHAR(20) NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REVOKED') NOT NULL DEFAULT 'DRAFT',
  `checklistJson` JSON NOT NULL,
  `gateSnapshotJson` JSON NULL,
  `overallAxesPassed` INT NOT NULL DEFAULT 0,
  `overallAxesTotal` INT NOT NULL DEFAULT 0,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `revokedAt` DATETIME(3) NULL,
  `revokedBy` VARCHAR(191) NULL,
  `revokeReason` VARCHAR(500) NULL,
  `notes` VARCHAR(1000) NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gst_uat_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
  INDEX `gst_uat_gstin_idx`(`tenantId`, `companyGstin`),
  CONSTRAINT `gst_compliance_uat_signoffs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `gst_compliance_uat_signoffs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
