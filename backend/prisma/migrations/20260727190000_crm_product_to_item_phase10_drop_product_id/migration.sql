-- Phase 10: drop obsolete CRM/Dispatch productId columns.
-- Product Master (master_products) is retained for engineering.
-- Commercial proforma/tax invoice lines still lack itemId — productId kept there.
-- Idempotent: IF EXISTS drops tolerate partial failure on live redeploy.

-- Sync dispatch itemId from SO header (phase 9 already enforced SO.itemId NOT NULL).
UPDATE dispatch_requirements dr
INNER JOIN crm_sales_orders so ON so.id = dr.salesOrderId
SET dr.itemId = so.itemId
WHERE (dr.itemId IS NULL OR dr.itemId = '')
  AND so.itemId IS NOT NULL
  AND so.itemId <> '';

ALTER TABLE `crm_opportunity_lines` DROP COLUMN IF EXISTS `productId`;
ALTER TABLE `crm_quotations` DROP COLUMN IF EXISTS `productId`;
ALTER TABLE `crm_sales_orders` DROP COLUMN IF EXISTS `productId`;
ALTER TABLE `dispatch_requirements` DROP COLUMN IF EXISTS `productId`;
