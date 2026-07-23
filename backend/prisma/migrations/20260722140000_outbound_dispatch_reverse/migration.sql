-- Phase 7C5 — reverse outbound dispatch (compensating FG inward + REVERSED status).

ALTER TABLE `outbound_dispatches`
  MODIFY COLUMN `status` ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reverseReason` TEXT NULL;

ALTER TABLE `outbound_dispatch_lines`
  ADD COLUMN `reverseInventoryMovementId` VARCHAR(191) NULL,
  ADD COLUMN `reverseInventoryMovementNo` VARCHAR(64) NULL;
