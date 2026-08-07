/**
 * Correct the remaining pre-fix MUOM PO lines + their GRN lines (created before the
 * planning→PO UOM fix). Verified first via probe-stale-muom-docs.ts:
 *   - No purchase invoices exist against any of these POs.
 *   - No inventory cost layers reference these items.
 *   - Base/stock quantities (Nos) are correct and are NOT touched.
 * Only vendor-UOM quantities, uomId, rate-basis amounts, and PO header totals change.
 * Idempotent: recomputing an already-fixed line produces identical values.
 *
 * Usage: npx tsx scripts/fix-stale-muom-po-grn.ts [--dry]
 */
import { prisma } from '../src/config/prisma.js'

const DRY = process.argv.includes('--dry')

const KG = 'abfc9cc5-08cf-4c8f-8d86-83bd255e7ef9'
const MTR = 'a48a8647-3c04-47d2-a78b-a9396993a093'

const TARGETS: Array<{ poLineId: string; factor: number; uomId: string; uomCode: string }> = [
  // PO-000086 / ROD-MUOM-KG — factor/amounts already fixed; completes uomId → KG
  { poLineId: 'd6d0a64c-77b5-4409-8880-3e2f12513890', factor: 50, uomId: KG, uomCode: 'KG' },
  // PO-000087 / PIPE-MUOM-MTR
  { poLineId: 'b4298064-f115-4e73-91c5-ca0a39fd9394', factor: 3, uomId: MTR, uomCode: 'MTR' },
  // PO-000088 / MS-PIPE-DN25-KG
  { poLineId: '11b73a43-3ac2-4543-bedb-cc23c90cf152', factor: 50, uomId: KG, uomCode: 'KG' },
]

function r2(n: number) {
  return Math.round(n * 100) / 100
}
function r4(n: number) {
  return Math.round(n * 10000) / 10000
}

async function main() {
  const touchedPoIds = new Set<string>()

  for (const t of TARGETS) {
    const line = await prisma.purchaseOrderLine.findUniqueOrThrow({ where: { id: t.poLineId } })
    touchedPoIds.add(line.purchaseOrderId)

    const rate = Number(line.rate)
    const baseQty = Number(line.quantity)
    const newUomQty = r4(baseQty * t.factor)
    const newAmount = r2(rate * newUomQty)
    const newUnitCostPrimary = r4(rate * t.factor)

    console.log(`\nPO line ${line.itemCodeSnapshot}:`, {
      factor: `${line.uomConversionFactor} -> ${t.factor}`,
      uomQuantity: `${line.uomQuantity} -> ${newUomQty}`,
      uomId: `${line.uomId} -> ${t.uomId} (${t.uomCode})`,
      amount: `${line.amount} -> ${newAmount}`,
    })

    if (!DRY) {
      await prisma.purchaseOrderLine.update({
        where: { id: t.poLineId },
        data: {
          uomConversionFactor: t.factor,
          uomQuantity: newUomQty,
          unitCostPrimary: newUnitCostPrimary,
          amount: newAmount,
          uomId: t.uomId,
        },
      })
    }

    const grnLines = await prisma.goodsReceiptLine.findMany({
      where: { purchaseOrderLineId: t.poLineId },
    })
    for (const gl of grnLines) {
      const glRate = Number(gl.rate)
      const newOrderedUom = r4(Number(gl.orderedQuantity) * t.factor)
      const newReceivedUom = r4(Number(gl.receivedQuantity) * t.factor)
      const newAcceptedUom = r4(Number(gl.acceptedQuantity) * t.factor)
      const newRejectedUom = r4(Number(gl.rejectedQuantity) * t.factor)
      const newGrnAmount = r2(glRate * newReceivedUom)

      console.log(`  GRN line (${gl.id}):`, {
        factor: `${gl.uomConversionFactor} -> ${t.factor}`,
        uomCode: `${gl.uomCodeSnapshot} -> ${t.uomCode}`,
        orderedUom: `${gl.orderedUomQuantity} -> ${newOrderedUom}`,
        receivedUom: `${gl.receivedUomQuantity} -> ${newReceivedUom}`,
        acceptedUom: `${gl.acceptedUomQuantity} -> ${newAcceptedUom}`,
        amount: `${gl.amount} -> ${newGrnAmount}`,
      })

      if (!DRY) {
        await prisma.goodsReceiptLine.update({
          where: { id: gl.id },
          data: {
            uomConversionFactor: t.factor,
            uomId: t.uomId,
            uomCodeSnapshot: t.uomCode,
            unitCostPrimary: r4(glRate * t.factor),
            orderedUomQuantity: newOrderedUom,
            receivedUomQuantity: newReceivedUom,
            acceptedUomQuantity: newAcceptedUom,
            rejectedUomQuantity: newRejectedUom,
            amount: newGrnAmount,
          },
        })
      }
    }
  }

  // Recompute PO header totals from per-line amounts + GST snapshots (mixed rates supported).
  for (const poId of touchedPoIds) {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: { lines: true },
    })
    const subtotal = r2(po.lines.reduce((s, l) => s + Number(l.amount), 0))
    const tax = r2(
      po.lines.reduce(
        (s, l) => s + r2((Number(l.amount) * Number(l.gstRatePctSnapshot)) / 100),
        0,
      ),
    )
    const total = r2(subtotal + tax + Number(po.freightAmount))
    console.log(`\n${po.orderNumber} header:`, {
      subtotal: `${po.subtotalAmount} -> ${subtotal}`,
      tax: `${po.taxAmount} -> ${tax}`,
      total: `${po.totalAmount} -> ${total}`,
    })
    if (!DRY) {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { subtotalAmount: subtotal, taxAmount: tax, totalAmount: total },
      })
    }
  }

  console.log(`\n${DRY ? '[dry-run] done' : '✓ applied'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
