-- Pre-existing schema drift fix (unrelated to Phase 5B1 treasury transfers):
-- FinanceSettings.createdBy / updatedBy exist in prisma/schema.prisma but were never
-- added to the finance_settings table by any prior migration. This blocks every finance
-- test (computeSetupStatus / activateRecord query these columns). Additive-only fix.

ALTER TABLE `finance_settings`
  ADD COLUMN `createdBy` VARCHAR(191) NULL,
  ADD COLUMN `updatedBy` VARCHAR(191) NULL;
