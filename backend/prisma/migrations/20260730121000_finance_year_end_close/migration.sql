-- Year-end P&L close into retained earnings (one successful run per financial year).

CREATE TABLE `year_end_close_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `financialYearId` VARCHAR(191) NOT NULL,
    `status` ENUM('POSTED', 'NO_ACTIVITY') NOT NULL,
    `postingDate` DATE NOT NULL,
    `revenueTotal` DECIMAL(18, 4) NOT NULL,
    `expenseTotal` DECIMAL(18, 4) NOT NULL,
    `profitOrLoss` DECIMAL(18, 4) NOT NULL,
    `retainedEarningsAccountId` VARCHAR(191) NOT NULL,
    `retainedEarningsCode` VARCHAR(32) NOT NULL,
    `retainedEarningsName` VARCHAR(200) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `postingEventId` VARCHAR(191) NULL,
    `voucherNumber` VARCHAR(64) NULL,
    `closedBy` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `year_end_close_runs_financialYearId_key`(`financialYearId`),
    INDEX `year_end_close_runs_tenantId_idx`(`tenantId`),
    INDEX `year_end_close_runs_legalEntityId_idx`(`legalEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `year_end_close_runs` ADD CONSTRAINT `year_end_close_runs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `year_end_close_runs` ADD CONSTRAINT `year_end_close_runs_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `year_end_close_runs` ADD CONSTRAINT `year_end_close_runs_financialYearId_fkey` FOREIGN KEY (`financialYearId`) REFERENCES `financial_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
