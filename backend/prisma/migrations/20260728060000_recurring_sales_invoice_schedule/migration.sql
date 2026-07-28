-- Recurring Sales Invoice schedules (Money In). Never creates a SalesInvoice directly —
-- each due cycle surfaces as a RecurringSalesInvoiceExecution ("upcoming invoice") that
-- must be explicitly approved. Mirrors the StandingInstruction (treasury) pattern.

-- CreateTable recurring_sales_invoice_schedules
CREATE TABLE `recurring_sales_invoice_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `nextInvoiceDate` DATE NOT NULL,
    `invoiceTemplate` JSON NOT NULL,
    `lastGeneratedAt` DATETIME(3) NULL,
    `lastGeneratedForDate` DATE NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `recurring_sales_invoice_schedules_tenantId_idx`(`tenantId`),
    INDEX `recur_si_sched_le_status_idx`(`tenantId`, `legalEntityId`, `status`),
    INDEX `recurring_sales_invoice_schedules_nextInvoiceDate_idx`(`nextInvoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable recurring_sales_invoice_executions
CREATE TABLE `recurring_sales_invoice_executions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `invoiceDate` DATE NOT NULL,
    `status` ENUM('SCHEDULED', 'APPROVED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `salesInvoiceId` VARCHAR(191) NULL,
    `failureReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `recurring_sales_invoice_executions_salesInvoiceId_key`(`salesInvoiceId`),
    UNIQUE INDEX `recur_si_exec_due_key`(`scheduleId`, `invoiceDate`),
    INDEX `recurring_sales_invoice_executions_tenantId_idx`(`tenantId`),
    INDEX `recur_si_exec_tenant_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey recurring_sales_invoice_schedules
ALTER TABLE `recurring_sales_invoice_schedules` ADD CONSTRAINT `recurring_sales_invoice_schedules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `recurring_sales_invoice_schedules` ADD CONSTRAINT `recurring_sales_invoice_schedules_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `recurring_sales_invoice_schedules` ADD CONSTRAINT `recurring_sales_invoice_schedules_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey recurring_sales_invoice_executions
ALTER TABLE `recurring_sales_invoice_executions` ADD CONSTRAINT `recurring_sales_invoice_executions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `recurring_sales_invoice_executions` ADD CONSTRAINT `recurring_sales_invoice_executions_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `recurring_sales_invoice_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `recurring_sales_invoice_executions` ADD CONSTRAINT `recurring_sales_invoice_executions_salesInvoiceId_fkey` FOREIGN KEY (`salesInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
