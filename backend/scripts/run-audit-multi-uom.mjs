/**
 * Run Multi-UOM data consistency audit via Prisma (read-only).
 * Column names match Prisma camelCase MySQL columns (not snake_case).
 * Usage: npx tsx scripts/run-audit-multi-uom.mjs
 */
import { prisma } from '../src/config/prisma.js'

function serialize(rows) {
  return JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2)
}

const QUERIES = [
  {
    label: '1) PO line drift (detail)',
    sql: `SELECT pol.id, po.orderNumber, pol.lineNumber, pol.uomQuantity, pol.quantity, pol.uomConversionFactor,
      ROUND(pol.uomQuantity / NULLIF(pol.uomConversionFactor, 0), 4) AS expectedBaseQty,
      ROUND(ABS(pol.quantity - (pol.uomQuantity / NULLIF(pol.uomConversionFactor, 0))), 4) AS qtyDrift
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.purchaseOrderId AND po.tenantId = pol.tenantId
    WHERE pol.uomConversionFactor > 0 AND pol.uomQuantity <> 0
      AND ABS(pol.quantity - (pol.uomQuantity / pol.uomConversionFactor)) > 0.01
    ORDER BY qtyDrift DESC LIMIT 100`,
  },
  {
    label: '2) GRN line drift (detail)',
    sql: `SELECT grl.id, gr.grnNumber, grl.lineNumber, grl.receivedUomQuantity, grl.receivedQuantity, grl.uomConversionFactor,
      ROUND(grl.receivedUomQuantity / NULLIF(grl.uomConversionFactor, 0), 4) AS expectedBaseQty,
      ROUND(ABS(grl.receivedQuantity - (grl.receivedUomQuantity / NULLIF(grl.uomConversionFactor, 0))), 4) AS qtyDrift
    FROM goods_receipt_lines grl
    JOIN goods_receipts gr ON gr.id = grl.goodsReceiptId AND gr.tenantId = grl.tenantId
    WHERE grl.uomConversionFactor > 0 AND grl.receivedUomQuantity <> 0
      AND ABS(grl.receivedQuantity - (grl.receivedUomQuantity / grl.uomConversionFactor)) > 0.01
    ORDER BY qtyDrift DESC LIMIT 100`,
  },
  {
    label: '3) Items missing conversion rows',
    sql: `SELECT mi.id, mi.code, mi.baseUomId, mi.purchaseUomId, mi.uomConversionFactor,
      (SELECT COUNT(*) FROM master_item_uom_conversions c WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId) AS conversionRows
    FROM master_items mi
    WHERE mi.deletedAt IS NULL AND mi.purchaseUomId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM master_item_uom_conversions c WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId)
    LIMIT 100`,
  },
  {
    label: '4) Summary counts',
    sql: `SELECT 'po_line_drift' AS checkName, COUNT(*) AS issueCount FROM purchase_order_lines pol
    WHERE pol.uomConversionFactor > 0 AND pol.uomQuantity <> 0
      AND ABS(pol.quantity - (pol.uomQuantity / pol.uomConversionFactor)) > 0.01
    UNION ALL SELECT 'grn_line_drift', COUNT(*) FROM goods_receipt_lines grl
    WHERE grl.uomConversionFactor > 0 AND grl.receivedUomQuantity <> 0
      AND ABS(grl.receivedQuantity - (grl.receivedUomQuantity / grl.uomConversionFactor)) > 0.01
    UNION ALL SELECT 'items_missing_conversions', COUNT(*) FROM master_items mi
    WHERE mi.deletedAt IS NULL AND mi.purchaseUomId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM master_item_uom_conversions c WHERE c.itemId = mi.id AND c.tenantId = mi.tenantId)`,
  },
]

async function main() {
  console.log('Multi-UOM data consistency audit (127.0.0.1 via DATABASE_URL)\n')

  for (const { label, sql } of QUERIES) {
    console.log(`=== ${label} ===`)
    try {
      const rows = await prisma.$queryRawUnsafe(sql)
      const count = Array.isArray(rows) ? rows.length : 0
      console.log(`rows: ${count}`)
      console.log(serialize(rows))
    } catch (e) {
      console.error('ERROR:', e.message)
      process.exitCode = 1
    }
    console.log('')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
