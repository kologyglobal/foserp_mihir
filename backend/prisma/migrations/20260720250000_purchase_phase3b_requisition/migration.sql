-- Purchase Phase 3B originally created a parallel PR schema (`prNumber` / manufacturing-shaped).
-- Canonical PurchaseRequisition tables are owned by
-- `20260720120000_add_purchase_requisition_planning_rfq` (`requisitionNumber` / purchase UI).
-- This migration is a no-op so fresh installs and drifted DBs converge on that schema.
-- Manufacturing still links via `production_order_materials.purchaseRequisitionId`
-- (FK added in `20260720260000_manufacturing_phase3c_pr_link_fk`).

SELECT 1;
