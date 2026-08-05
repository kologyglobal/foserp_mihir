-- Read-only Multi-UOM data consistency audit (Phase 0).
-- Run against tenant DB after backup. No writes.

-- 1) PO lines: base qty should match uomQuantity / factor
SELECT
  pol.id,
  po.order_number,
  pol.line_number,
  pol.uom_quantity,
  pol.quantity,
  pol.uom_conversion_factor,
  ROUND(pol.uom_quantity / NULLIF(pol.uom_conversion_factor, 0), 4) AS expected_base_qty,
  ROUND(ABS(pol.quantity - (pol.uom_quantity / NULLIF(pol.uom_conversion_factor, 0))), 4) AS qty_drift
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.purchase_order_id AND po.tenant_id = pol.tenant_id
WHERE pol.uom_conversion_factor > 0
  AND pol.uom_quantity <> 0
  AND ABS(pol.quantity - (pol.uom_quantity / pol.uom_conversion_factor)) > 0.01
ORDER BY qty_drift DESC
LIMIT 100;

-- 2) GRN lines: received base vs received vendor qty
SELECT
  grl.id,
  gr.grn_number,
  grl.line_number,
  grl.received_uom_quantity,
  grl.received_quantity,
  grl.uom_conversion_factor,
  ROUND(grl.received_uom_quantity / NULLIF(grl.uom_conversion_factor, 0), 4) AS expected_base_qty,
  ROUND(ABS(grl.received_quantity - (grl.received_uom_quantity / NULLIF(grl.uom_conversion_factor, 0))), 4) AS qty_drift
FROM goods_receipt_lines grl
JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id AND gr.tenant_id = grl.tenant_id
WHERE grl.uom_conversion_factor > 0
  AND grl.received_uom_quantity <> 0
  AND ABS(grl.received_quantity - (grl.received_uom_quantity / grl.uom_conversion_factor)) > 0.01
ORDER BY qty_drift DESC
LIMIT 100;

-- 3) Items: legacy purchase UOM set but no conversion rows
SELECT
  mi.id,
  mi.code,
  mi.base_uom_id,
  mi.purchase_uom_id,
  mi.uom_conversion_factor,
  (SELECT COUNT(*) FROM master_item_uom_conversions c WHERE c.item_id = mi.id AND c.tenant_id = mi.tenant_id) AS conversion_rows
FROM master_items mi
WHERE mi.deleted_at IS NULL
  AND mi.purchase_uom_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_item_uom_conversions c
    WHERE c.item_id = mi.id AND c.tenant_id = mi.tenant_id
  )
LIMIT 100;

-- 4) Summary counts
SELECT 'po_line_drift' AS check_name, COUNT(*) AS issue_count
FROM purchase_order_lines pol
WHERE pol.uom_conversion_factor > 0
  AND pol.uom_quantity <> 0
  AND ABS(pol.quantity - (pol.uom_quantity / pol.uom_conversion_factor)) > 0.01
UNION ALL
SELECT 'grn_line_drift', COUNT(*)
FROM goods_receipt_lines grl
WHERE grl.uom_conversion_factor > 0
  AND grl.received_uom_quantity <> 0
  AND ABS(grl.received_quantity - (grl.received_uom_quantity / grl.uom_conversion_factor)) > 0.01
UNION ALL
SELECT 'items_missing_conversions', COUNT(*)
FROM master_items mi
WHERE mi.deleted_at IS NULL
  AND mi.purchase_uom_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_item_uom_conversions c
    WHERE c.item_id = mi.id AND c.tenant_id = mi.tenant_id
  );
