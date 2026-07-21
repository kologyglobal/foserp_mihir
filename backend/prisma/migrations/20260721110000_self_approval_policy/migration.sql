-- Self-approval policy (maker-checker override) on purchase settings.
-- NEVER            → strict segregation of duties (previous hard-coded behaviour)
-- PERMISSION_ONLY  → users holding purchase.approvals.self_approve may approve own documents (default)
-- EVERYONE         → no maker-checker restriction (not recommended)

-- AlterTable
ALTER TABLE `purchase_settings`
  ADD COLUMN `selfApprovalPolicy` ENUM('NEVER', 'PERMISSION_ONLY', 'EVERYONE') NOT NULL DEFAULT 'PERMISSION_ONLY';
