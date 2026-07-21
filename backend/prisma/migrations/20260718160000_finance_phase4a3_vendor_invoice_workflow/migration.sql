-- Phase 4A3 — Vendor invoice draft workflow: approval FK + calculation context + cancel reason

ALTER TABLE `vendor_invoices`
  ADD COLUMN `approvalRequestId` VARCHAR(191) NULL,
  ADD COLUMN `calculationContext` JSON NULL,
  ADD COLUMN `cancellationReason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `vendor_invoices_approvalRequestId_key` ON `vendor_invoices`(`approvalRequestId`);

ALTER TABLE `vendor_invoices`
  ADD CONSTRAINT `vendor_invoices_approvalRequestId_fkey`
  FOREIGN KEY (`approvalRequestId`) REFERENCES `finance_approval_requests`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
