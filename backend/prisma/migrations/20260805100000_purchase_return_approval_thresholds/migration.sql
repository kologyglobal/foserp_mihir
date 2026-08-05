-- Purchase Setup: optional material-return approval thresholds
ALTER TABLE `purchase_settings`
  ADD COLUMN `requireReturnApproval` BOOLEAN NOT NULL DEFAULT false AFTER `notificationPreferences`,
  ADD COLUMN `returnApprovalQtyThreshold` DECIMAL(18, 4) NULL AFTER `requireReturnApproval`,
  ADD COLUMN `returnApprovalValueThreshold` DECIMAL(18, 2) NULL AFTER `returnApprovalQtyThreshold`;
