-- Product-centric planning is the intended default: prefer consolidated demand view.
ALTER TABLE `purchase_settings`
  MODIFY COLUMN `planningConsolidationEnabled` BOOLEAN NOT NULL DEFAULT true;

-- Flip existing tenants that still have the previous ship default (false).
UPDATE `purchase_settings`
SET `planningConsolidationEnabled` = true
WHERE `planningConsolidationEnabled` = false;
