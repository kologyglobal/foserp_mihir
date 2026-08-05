-- Read-only Multi-UOM data consistency audit (Phase 0).
-- Run against tenant DB after backup. No writes.
-- NOTE: This project uses Prisma camelCase column names in MySQL (orderNumber, not order_number).

-- 1) PO lines: base qty should match uomQuantity / factor
SELECT
  pol.id,
  po.orderNumber,
  pol.lineNumber,
  pol.uomQuantity,
  pol.quantity,
  pol.uomConversionFactor,
  ROUND(pol.uomQuantity / NULLIF(pol.uomConversionFactor, 0), 4) AS expectedBaseQty,
  ROUND(ABS(pol.quantity - (pol.uomQuantity / NULLIF(pol.uomConversionFactor, 0))), 4) AS qtyDrift
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.purchaseOrderId AND po.tenantId = pol.tenantId
WHERE pol.uomConversionFactor > 0
  AND pol.uomQuantity <> 0
  AND ABS(pol.quantity - (pol.uomQuantity / pol.uomConversionFactor)) > 0.01
ORDER BY qtyDrift DESC
LIMIT 100;

-- 2) GRN lines: received base vs received vendor qty
SELECT
  grl.id,
  gr.grnNumber,
  grl.lineNumber,
  grl.receivedUomQuantity,
  grl.receivedQuantity,
  grl.uomConversionFactor,
  ROUND(grl.receivedUomQuantity / NULLIF(grl.uomConversionFactor, 0), 4) AS expectedBaseQty,
  ROUND(ABS(grl.receivedQuantity - (grl.receivedUomQuantity / NULLIF(grl.uomConversionFactor, 0))), 4) AS qtyDrift
FROM goods_receipt_lines grl
JOIN goods_receipts gr ON gr.id = grl.goodsReceiptId AND gr.tenantId = grl.tenantId
WHERE grl.uomConversionFactor > 0
  AND grl.receivedUomQuantity <> 0
  AND ABS(grl.receivedQuantity - (grl.receivedUomQuantity / grl.uomConversionFactor)) > 0.01
ORDER BY qtyDrift DESC
LIMIT 100;

-- 3) Items: legacy purchase UOM set but no conversion rows
SELECT
  mi.id,
  mi.code,
  mi.baseUomId,
  mi.purchaseUomId,
  mi.uomConversionFactor,
  (SELECT COUNT(*) FROM master_item_uom_conversions c WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId) AS conversionRows
FROM master_items mi
WHERE mi.deletedAt IS NULL
  AND mi.purchaseUomId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_item_uom_conversions c
    WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId
  )
LIMIT 100;

-- 4) Summary counts (certification gate: all should be 0)
SELECT 'po_line_drift' AS checkName, COUNT(*) AS issueCount
FROM purchase_order_lines pol
WHERE pol.uomConversionFactor > 0
  AND pol.uomQuantity <> 0
  AND ABS(pol.quantity - (pol.uomQuantity / pol.uomConversionFactor)) > 0.01
UNION ALL
SELECT 'grn_line_drift', COUNT(*)
FROM goods_receipt_lines grl
WHERE grl.uomConversionFactor > 0
  AND grl.receivedUomQuantity <> 0
  AND ABS(grl.receivedQuantity - (grl.receivedUomQuantity / grl.uomConversionFactor)) > 0.01
UNION ALL
SELECT 'items_missing_conversions', COUNT(*)
FROM master_items mi
WHERE mi.deletedAt IS NULL
  AND mi.purchaseUomId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_item_uom_conversions c
    WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId
  );
