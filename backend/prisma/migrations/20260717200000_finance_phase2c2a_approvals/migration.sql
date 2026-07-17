-- Finance Phase 2C2A — Runtime approval requests (journal workflow, no posting)

CREATE TABLE `finance_approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('JOURNAL', 'PAYMENT', 'RECEIPT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PERIOD_REOPEN') NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentNumberSnapshot` VARCHAR(64) NULL,
    `documentStatusSnapshot` VARCHAR(32) NULL,
    `cycleNumber` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('PENDING', 'APPROVED', 'SENT_BACK', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `amountBasis` DECIMAL(18, 4) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `currentLevel` INTEGER NOT NULL DEFAULT 1,
    `totalLevels` INTEGER NOT NULL DEFAULT 1,
    `requestedBy` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `ruleSnapshotJson` JSON NULL,
    `workflowSnapshotJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fin_appr_req_doc_cycle_key`(`tenantId`, `legalEntityId`, `documentType`, `documentId`, `cycleNumber`),
    INDEX `fin_appr_req_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `fin_appr_req_doc_idx`(`documentType`, `documentId`),
    INDEX `fin_appr_req_requester_idx`(`requestedBy`, `requestedAt`),
    INDEX `fin_appr_req_level_status_idx`(`currentLevel`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `finance_approval_steps` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `approvalRequestId` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `approverRoleId` VARCHAR(191) NULL,
    `approverUserId` VARCHAR(191) NULL,
    `status` ENUM('WAITING', 'PENDING', 'APPROVED', 'SENT_BACK', 'REJECTED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'WAITING',
    `actedBy` VARCHAR(191) NULL,
    `actedAt` DATETIME(3) NULL,
    `comments` VARCHAR(1000) NULL,
    `delegatedFromUserId` VARCHAR(191) NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fin_appr_step_level_seq_key`(`approvalRequestId`, `level`, `sequence`),
    INDEX `finance_approval_steps_tenantId_idx`(`tenantId`),
    INDEX `fin_appr_step_req_status_idx`(`approvalRequestId`, `status`),
    INDEX `fin_appr_step_user_status_idx`(`approverUserId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `finance_approval_requests` ADD CONSTRAINT `finance_approval_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_approval_requests` ADD CONSTRAINT `finance_approval_requests_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `finance_approval_steps` ADD CONSTRAINT `finance_approval_steps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_approval_steps` ADD CONSTRAINT `finance_approval_steps_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `finance_approval_steps` ADD CONSTRAINT `finance_approval_steps_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `finance_approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
