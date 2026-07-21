-- AR sales invoice document reverse — REVERSED status + reversal link/audit columns.
-- Non-destructive additive migration. MySQL-safe ENUM extend via MODIFY COLUMN.

ALTER TABLE `sales_invoices`
  MODIFY COLUMN `status` ENUM('DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `sales_invoices`
  ADD COLUMN `reversalVoucherId` VARCHAR(191) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `sales_invoices_reversalVoucherId_key` ON `sales_invoices`(`reversalVoucherId`);

ALTER TABLE `sales_invoices`
  ADD CONSTRAINT `sales_invoices_reversalVoucherId_fkey`
    FOREIGN KEY (`reversalVoucherId`) REFERENCES `accounting_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
