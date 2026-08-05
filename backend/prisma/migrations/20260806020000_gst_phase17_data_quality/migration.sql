-- Phase 17 — GST data quality evidence runs (companyGstin backfill / freeze checklist).
-- Does not alter gst_ledger_entries structure; backfill updates null companyGstin via app only.

CREATE TABLE `gst_data_quality_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `companyGstin` VARCHAR(20) NULL,
    `returnPeriod` VARCHAR(7) NOT NULL,
    `runKind` ENUM('SCAN', 'BACKFILL_DRY_RUN', 'FULL_REPORT') NOT NULL DEFAULT 'FULL_REPORT',
    `status` ENUM('GENERATED', 'ACKNOWLEDGED', 'VOID') NOT NULL DEFAULT 'GENERATED',
    `nullGstinCount` INTEGER NOT NULL DEFAULT 0,
    `filedNullCount` INTEGER NOT NULL DEFAULT 0,
    `distinctGstinCount` INTEGER NOT NULL DEFAULT 0,
    `backfillCandidateCount` INTEGER NOT NULL DEFAULT 0,
    `unresolvableCount` INTEGER NOT NULL DEFAULT 0,
    `scorePct` INTEGER NOT NULL DEFAULT 0,
    `overall` VARCHAR(32) NOT NULL,
    `freezeReady` BOOLEAN NOT NULL DEFAULT false,
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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `gst_dq_le_period_idx` ON `gst_data_quality_runs`(`tenantId`, `legalEntityId`, `returnPeriod`);
CREATE INDEX `gst_dq_status_idx` ON `gst_data_quality_runs`(`tenantId`, `status`);

ALTER TABLE `gst_data_quality_runs`
  ADD CONSTRAINT `gst_data_quality_runs_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `gst_data_quality_runs`
  ADD CONSTRAINT `gst_data_quality_runs_legalEntityId_fkey`
  FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
