/**
 * One-time correction: PO-000086 line 1 (ROD-MUOM-KG) was created before the planning→PO
 * UOM fix, so it's frozen at factor 1 (16 Nos "=" 16 KG) instead of the item master's real
 * factor 50 (16 Nos = 800 KG). No inventory cost layers exist for this item (verified via
 * probe-po086-grn-cost.ts) and no invoice has been posted yet, so this is safe to correct
 * in place: base/stock quantities (Nos) are untouched — only the vendor-UOM (KG) quantities,
 * rate-basis amount, and PO header totals are recalculated.
 *
 * Usage: npx tsx scripts/fix-po086-rod-muom-factor.ts
 */
import { prisma } from '../src/config/prisma.js'

const PO_ID = '7ebdafe2-3d30-447d-a964-a0c2261a27a7'
const PO_LINE_ID = 'd6d0a64c-77b5-4409-8880-3e2f12513890'
const GRN_LINE_ID = 'c6ba3527-1ab2-432a-918b-d362e49f6ab0'
const FACTOR = 50

function r2(n: number) {
  return Math.round(n * 100) / 100
}

async function main() {
  const poLine = await prisma.purchaseOrderLine.findUniqueOrThrow({ where: { id: PO_LINE_ID } })
  const grnLine = await prisma.goodsReceiptLine.findUniqueOrThrow({ where: { id: GRN_LINE_ID } })
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: PO_ID } })

  if (Number(poLine.uomConversionFactor) === FACTOR) {
    console.log('Already at factor', FACTOR, '— nothing to do.')
    return
  }

  const rate = Number(poLine.rate)
  const baseQty = Number(poLine.quantity)
  const newUomQuantity = r2(baseQty * FACTOR)
  const newAmount = r2(rate * newUomQuantity)
  const amountDelta = r2(newAmount - Number(poLine.amount))

  const igstRate = Number(poLine.igstRateSnapshot)
  const cgstRate = Number(poLine.cgstRateSnapshot)
  const sgstRate = Number(poLine.sgstRateSnapshot)
  const oldTax = r2(Number(poLine.amount) * ((igstRate || cgstRate + sgstRate) / 100))
  const newTax = r2(newAmount * ((igstRate || cgstRate + sgstRate) / 100))
  const taxDelta = r2(newTax - oldTax)

  const newSubtotal = r2(Number(po.subtotalAmount) + amountDelta)
  const newTaxAmount = r2(Number(po.taxAmount) + taxDelta)
  const newTotal = r2(newSubtotal + newTaxAmount + Number(po.freightAmount))

  const newReceivedUom = r2(Number(grnLine.receivedQuantity) * FACTOR)
  const newAcceptedUom = r2(Number(grnLine.acceptedQuantity) * FACTOR)
  const newOrderedUom = newUomQuantity
  const newGrnAmount = r2(Number(grnLine.rate) * newReceivedUom)

  console.log('PO line:', {
    uomQuantity: `${poLine.uomQuantity} -> ${newUomQuantity}`,
    factor: `${poLine.uomConversionFactor} -> ${FACTOR}`,
    unitCostPrimary: `${poLine.unitCostPrimary} -> ${r2(rate * FACTOR)}`,
    amount: `${poLine.amount} -> ${newAmount}`,
  })
  console.log('PO header:', {
    subtotalAmount: `${po.subtotalAmount} -> ${newSubtotal}`,
    taxAmount: `${po.taxAmount} -> ${newTaxAmount}`,
    totalAmount: `${po.totalAmount} -> ${newTotal}`,
  })
  console.log('GRN line:', {
    orderedUomQuantity: `${grnLine.orderedUomQuantity} -> ${newOrderedUom}`,
    receivedUomQuantity: `${grnLine.receivedUomQuantity} -> ${newReceivedUom}`,
    acceptedUomQuantity: `${grnLine.acceptedUomQuantity} -> ${newAcceptedUom}`,
    factor: `${grnLine.uomConversionFactor} -> ${FACTOR}`,
    amount: `${grnLine.amount} -> ${newGrnAmount}`,
  })

  await prisma.$transaction([
    prisma.purchaseOrderLine.update({
      where: { id: PO_LINE_ID },
      data: {
        uomConversionFactor: FACTOR,
        uomQuantity: newUomQuantity,
        unitCostPrimary: r2(rate * FACTOR),
        amount: newAmount,
      },
    }),
    prisma.purchaseOrder.update({
      where: { id: PO_ID },
      data: {
        subtotalAmount: newSubtotal,
        taxAmount: newTaxAmount,
        totalAmount: newTotal,
      },
    }),
    prisma.goodsReceiptLine.update({
      where: { id: GRN_LINE_ID },
      data: {
        uomConversionFactor: FACTOR,
        unitCostPrimary: r2(rate * FACTOR),
        orderedUomQuantity: newOrderedUom,
        receivedUomQuantity: newReceivedUom,
        acceptedUomQuantity: newAcceptedUom,
        amount: newGrnAmount,
      },
    }),
  ])

  console.log('\n✓ PO-000086 / GRN-000059 corrected to factor', FACTOR)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
