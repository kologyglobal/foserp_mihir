-- Finance Phase 5C1 — Treasury day-close controls (soft close; does not lock GL periods).

CREATE TABLE `treasury_day_closes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `closeDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'REVIEWED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `bookBankBalance` DECIMAL(18, 4) NOT NULL,
    `bookCashBalance` DECIMAL(18, 4) NOT NULL,
    `availableLiquidity` DECIMAL(18, 4) NOT NULL,
    `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `checklistJson` JSON NOT NULL,
    `notes` VARCHAR(1000) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(191) NULL,
    `reopenReason` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `treasury_day_close_date_key` ON `treasury_day_closes`(`tenantId`, `legalEntityId`, `closeDate`);
CREATE INDEX `treasury_day_closes_tenantId_idx` ON `treasury_day_closes`(`tenantId`);
CREATE INDEX `treasury_day_close_status_idx` ON `treasury_day_closes`(`tenantId`, `legalEntityId`, `status`);

ALTER TABLE `treasury_day_closes` ADD CONSTRAINT `treasury_day_closes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `treasury_day_closes` ADD CONSTRAINT `treasury_day_closes_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
