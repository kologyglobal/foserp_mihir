import { prisma } from '../src/config/prisma.js'

const TENANT_ID = '795be403-0588-4a81-b3ea-9f755f60c329'

async function main() {
  const uoms = await prisma.masterUom.findMany({
    where: { tenantId: TENANT_ID, code: { in: ['NOS', 'Nos', 'KG', 'MTR'] }, deletedAt: null },
    select: { id: true, code: true },
  })
  console.log('UOMs:', uoms)

  for (const orderNumber of ['PO-000086', 'PO-000087', 'PO-000088']) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { tenantId: TENANT_ID, orderNumber },
      include: {
        lines: {
          select: {
            id: true,
            itemCodeSnapshot: true,
            quantity: true,
            uomQuantity: true,
            uomConversionFactor: true,
            uomId: true,
            rate: true,
            amount: true,
            receivedQuantity: true,
            acceptedQuantity: true,
            invoicedQuantity: true,
            unitCostPrimary: true,
          },
        },
      },
    })
    if (!po) continue
    console.log(`\n=== ${orderNumber} (${po.status}) subtotal=${po.subtotalAmount} tax=${po.taxAmount} total=${po.totalAmount} ===`)
    for (const l of po.lines) {
      console.log(' PO line:', {
        id: l.id,
        item: l.itemCodeSnapshot,
        qty: l.quantity.toString(),
        uomQty: l.uomQuantity.toString(),
        factor: l.uomConversionFactor.toString(),
        uomId: l.uomId,
        rate: l.rate.toString(),
        amount: l.amount.toString(),
        received: l.receivedQuantity.toString(),
        invoiced: l.invoicedQuantity.toString(),
      })
      const grnLines = await prisma.goodsReceiptLine.findMany({
        where: { purchaseOrderLineId: l.id },
        select: {
          id: true,
          goodsReceipt: { select: { grnNumber: true, status: true, id: true } },
          uomId: true,
          uomCodeSnapshot: true,
          uomConversionFactor: true,
          orderedQuantity: true,
          receivedQuantity: true,
          acceptedQuantity: true,
          orderedUomQuantity: true,
          receivedUomQuantity: true,
          acceptedUomQuantity: true,
          rejectedUomQuantity: true,
          rejectedQuantity: true,
          rate: true,
          amount: true,
          unitCostPrimary: true,
        },
      })
      for (const gl of grnLines) {
        console.log('   GRN line:', {
          id: gl.id,
          grn: gl.goodsReceipt.grnNumber,
          grnId: gl.goodsReceipt.id,
          status: gl.goodsReceipt.status,
          uomCode: gl.uomCodeSnapshot,
          factor: gl.uomConversionFactor.toString(),
          ordered: gl.orderedQuantity.toString(),
          received: gl.receivedQuantity.toString(),
          accepted: gl.acceptedQuantity.toString(),
          orderedUom: gl.orderedUomQuantity.toString(),
          receivedUom: gl.receivedUomQuantity.toString(),
          acceptedUom: gl.acceptedUomQuantity.toString(),
          rate: gl.rate.toString(),
          amount: gl.amount.toString(),
        })
      }
    }
    const invoices = await prisma.purchaseInvoice.findMany({
      where: { tenantId: TENANT_ID, purchaseOrderId: po.id, deletedAt: null },
      select: { invoiceNumber: true, status: true },
    })
    console.log(' Invoices:', invoices)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
