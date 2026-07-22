-- Quality Phase 7B — integration, revisions, certificates, release controls

ALTER TABLE `manufacturing_profiles`
    ADD COLUMN `qualityHoldWarehouseId` VARCHAR(191) NULL;

ALTER TABLE `quality_inspection_plans`
    ADD COLUMN `samplingMethod` ENUM('FULL_INSPECTION','FIXED_SAMPLE','PERCENTAGE','MANUAL_SAMPLE') NULL DEFAULT 'FULL_INSPECTION',
    ADD COLUMN `sampleSizeMode` VARCHAR(32) NULL,
    ADD COLUMN `fixedSampleSize` DECIMAL(18,4) NULL,
    ADD COLUMN `samplePercentage` DECIMAL(7,4) NULL,
    ADD COLUMN `certificateRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `currentRevisionId` VARCHAR(191) NULL,
    ADD COLUMN `acceptanceRule` VARCHAR(64) NULL;

ALTER TABLE `quality_inspections`
    ADD COLUMN `inspectionPlanRevisionId` VARCHAR(191) NULL,
    ADD COLUMN `planCodeSnapshot` VARCHAR(64) NULL,
    ADD COLUMN `planRevisionSnapshot` VARCHAR(32) NULL,
    ADD COLUMN `sampleQty` DECIMAL(18,4) NULL,
    ADD COLUMN `conditionallyAcceptedQty` DECIMAL(18,4) NULL,
    ADD COLUMN `heldQty` DECIMAL(18,4) NULL,
    ADD COLUMN `scrapQty` DECIMAL(18,4) NULL,
    ADD COLUMN `pendingQty` DECIMAL(18,4) NULL,
    ADD COLUMN `stockDisposition` ENUM('QUARANTINE','UNRESTRICTED','REWORK','SUPPLIER_RETURN','SCRAP','HOLD','USE_AS_IS') NULL,
    ADD COLUMN `qualityHoldWarehouseId` VARCHAR(191) NULL,
    ADD COLUMN `warehouseFromId` VARCHAR(191) NULL,
    ADD COLUMN `warehouseToId` VARCHAR(191) NULL,
    ADD COLUMN `certificateRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `certificateStatus` ENUM('PENDING','VERIFIED','REJECTED','EXPIRED') NULL,
    ADD COLUMN `supersededById` VARCHAR(191) NULL,
    ADD COLUMN `supersedesId` VARCHAR(191) NULL,
    ADD COLUMN `releaseIdempotencyKey` VARCHAR(150) NULL,
    ADD COLUMN `decisionReason` TEXT NULL,
    ADD COLUMN `sourceType` VARCHAR(64) NULL,
    ADD COLUMN `sourceDocumentId` VARCHAR(191) NULL,
    ADD COLUMN `sourceDocumentNumber` VARCHAR(64) NULL;

ALTER TABLE `quality_ncrs`
    ADD COLUMN `disposition` ENUM('REWORK','RETURN_TO_SUPPLIER','SCRAP','USE_AS_IS','DEVIATION','SORT_AND_ACCEPT','REINSPECT','HOLD') NULL,
    ADD COLUMN `dispositionQuantity` DECIMAL(18,4) NULL,
    ADD COLUMN `containmentAction` TEXT NULL,
    ADD COLUMN `rootCause` TEXT NULL,
    ADD COLUMN `correctiveAction` TEXT NULL,
    ADD COLUMN `preventiveAction` TEXT NULL,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `targetDate` DATETIME(3) NULL,
    ADD COLUMN `jobWorkOrderId` VARCHAR(191) NULL,
    ADD COLUMN `supplierId` VARCHAR(191) NULL,
    ADD COLUMN `effectivenessReview` TEXT NULL,
    ADD COLUMN `dispositionNotes` TEXT NULL;

ALTER TABLE `quality_inspections`
    MODIFY COLUMN `category` ENUM('INCOMING','IN_PROCESS','FINAL','SUBCONTRACT_RETURN','MATERIAL_RETURN','REWORK','AD_HOC') NOT NULL,
    MODIFY COLUMN `status` ENUM('PENDING','READY','IN_PROGRESS','COMPLETED','DECIDED','SUPERSEDED','PASSED','REWORK','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    MODIFY COLUMN `decision` ENUM('PASS','CONDITIONAL_PASS','HOLD','USE_AS_IS','CANCELLED','SUPERSEDED','REWORK','REJECT') NULL;

ALTER TABLE `quality_inspection_plans`
    MODIFY COLUMN `category` ENUM('INCOMING','IN_PROCESS','FINAL','SUBCONTRACT_RETURN','MATERIAL_RETURN','REWORK','AD_HOC') NOT NULL;

ALTER TABLE `quality_ncrs`
    MODIFY COLUMN `status` ENUM('OPEN','DISPOSITION_PENDING','ACTION_IN_PROGRESS','VERIFICATION_PENDING','INVESTIGATING','CORRECTIVE_ACTION','APPROVED','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN';

ALTER TABLE `inventory_stock_movements`
    MODIFY COLUMN `referenceType` ENUM('OPN','INW','ISS','ADJ','GRN','ISSUE_TO_WO','RETURN_FROM_WO','WIP_RECEIVE','WIP_TRANSFER','MOVE_TO_WIP','MOVE_FROM_WIP','SA_RECEIPT','FG_RECEIPT','DISPATCH','FG_DISPATCH','SUBCON_OUT','SUBCON_IN','QUALITY_RELEASE','QUALITY_HOLD','QUALITY_REJECT') NOT NULL;

CREATE TABLE `quality_inspection_plan_revisions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inspectionPlanId` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `revisionCode` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT','PENDING_APPROVAL','ACTIVE','SUPERSEDED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `changeReason` TEXT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `linesSnapshotJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    UNIQUE INDEX `quality_plan_revision_number`(`inspectionPlanId`, `revisionNumber`),
    INDEX `quality_plan_revision_tenant_idx`(`tenantId`),
    INDEX `quality_plan_revision_plan_idx`(`tenantId`, `inspectionPlanId`),
    INDEX `quality_plan_revision_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quality_certificates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `certificateNumber` VARCHAR(64) NOT NULL,
    `certificateType` ENUM('SUPPLIER_TEST','MATERIAL_TEST','HEAT','DIMENSIONAL','INSPECTION_REPORT','PRESSURE_TEST','LEAK_TEST','ELECTRICAL_TEST','CALIBRATION','FINAL_QC','SUBCONTRACT','OTHER') NOT NULL,
    `status` ENUM('PENDING','VERIFIED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',
    `documentNumber` VARCHAR(64) NULL,
    `issueDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `inspectionId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `lotOrBatch` VARCHAR(128) NULL,
    `heatNumber` VARCHAR(128) NULL,
    `supplierOrLab` VARCHAR(200) NULL,
    `attachmentRef` VARCHAR(500) NULL,
    `verifiedBy` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    UNIQUE INDEX `quality_certificate_number`(`tenantId`, `certificateNumber`),
    INDEX `quality_certificate_tenant_idx`(`tenantId`),
    INDEX `quality_certificate_inspection_idx`(`tenantId`, `inspectionId`),
    INDEX `quality_certificate_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `manufacturing_profiles_qualityHoldWarehouseId_idx` ON `manufacturing_profiles`(`qualityHoldWarehouseId`);
CREATE INDEX `quality_inspections_inspectionPlanRevisionId_idx` ON `quality_inspections`(`tenantId`, `inspectionPlanRevisionId`);
CREATE INDEX `quality_inspections_releaseIdempotencyKey_idx` ON `quality_inspections`(`tenantId`, `releaseIdempotencyKey`);
CREATE INDEX `quality_ncrs_jobWorkOrderId_idx` ON `quality_ncrs`(`tenantId`, `jobWorkOrderId`);
