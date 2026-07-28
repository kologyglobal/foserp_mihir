-- Phase 10: drop obsolete CRM/Dispatch productId columns.
-- Product Master (master_products) is retained for engineering.
-- Commercial proforma/tax invoice lines still lack itemId — productId kept there.

-- Ensure dispatch requirements are item-backed before drop.
UPDATE dispatch_requirements dr
INNER JOIN master_products p ON p.id = dr.productId
SET dr.itemId = p.fgItemId
WHERE (dr.itemId IS NULL OR dr.itemId = '')
  AND p.fgItemId IS NOT NULL
  AND p.fgItemId <> '';

ALTER TABLE `crm_opportunity_lines` DROP COLUMN `productId`;
ALTER TABLE `crm_quotations` DROP COLUMN `productId`;
ALTER TABLE `crm_sales_orders` DROP COLUMN `productId`;
ALTER TABLE `dispatch_requirements` DROP COLUMN `productId`;
