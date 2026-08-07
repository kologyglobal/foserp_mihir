/**
 * Probe live DB for purchase invoice three-way match chain + history.
 *
 * Usage:
 *   PI_ID=9ab33ee5-72e7-47bb-a3c5-b3fdeb4cb75b TENANT_SLUG=vasant-trailers npx tsx scripts/probe-pi-get-live.ts
 */
import { prisma } from '../src/config/prisma.js'

const PI_ID = process.env.PI_ID ?? '9ab33ee5-72e7-47bb-a3c5-b3fdeb4cb75b'
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

function n(v: unknown): number {
  return Number(v ?? 0)
}

async function main() {
  const db = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`
  console.log('Connected to:', db[0]?.db)
  console.log('PI_ID:', PI_ID, 'TENANT_SLUG:', TENANT_SLUG)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
    select: { id: true, slug: true },
  })
  if (!tenant) {
    console.error('Tenant not found:', TENANT_SLUG)
    process.exit(1)
  }

  const inv = await prisma.purchaseInvoice.findFirst({
    where: { id: PI_ID, tenantId: tenant.id, deletedAt: null },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!inv) {
    console.error('Purchase invoice not found')
    process.exit(1)
  }

  const vendor = await prisma.masterVendor.findFirst({
    where: { id: inv.vendorId, tenantId: tenant.id },
    select: { code: true, name: true },
  })

  const po = inv.purchaseOrderId
    ? await prisma.purchaseOrder.findFirst({
        where: { id: inv.purchaseOrderId, tenantId: tenant.id, deletedAt: null },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })
    : null

  const grn = inv.goodsReceiptId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: inv.goodsReceiptId, tenantId: tenant.id, deletedAt: null },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })
    : null

  const history = await prisma.purchaseStatusHistory.findMany({
    where: {
      tenantId: tenant.id,
      documentType: 'PURCHASE_INVOICE',
      documentId: inv.id,
    },
    orderBy: { createdAt: 'asc' },
  })

  const setup = await prisma.purchaseSettings.findFirst({
    where: { tenantId: tenant.id },
    select: {
      quantityTolerancePct: true,
      rateTolerancePct: true,
      amountToleranceInr: true,
      amountTolerancePct: true,
      taxToleranceInr: true,
      taxTolerancePct: true,
    },
  })

  console.log('\n=== INVOICE HEADER ===')
  console.log(JSON.stringify({
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    vendor: vendor ? `${vendor.code} — ${vendor.name}` : inv.vendorId,
    vendorInvoiceNumber: inv.vendorInvoiceNumber,
    invoiceDate: inv.invoiceDate,
    purchaseOrderId: inv.purchaseOrderId,
    goodsReceiptId: inv.goodsReceiptId,
    matchingStatus: inv.matchingStatus,
    matchingRemarks: inv.matchingRemarks,
    overrideAuthorized: inv.overrideAuthorized,
    subtotalAmount: n(inv.subtotalAmount),
    taxAmount: n(inv.taxAmount),
    totalAmount: n(inv.totalAmount),
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    submittedAt: inv.submittedAt,
  }, null, 2))

  console.log('\n=== INVOICE LINES ===')
  for (const line of inv.lines) {
    console.log(JSON.stringify({
      lineNumber: line.lineNumber,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      quantity: n(line.quantity),
      uomQuantitySnapshot: line.uomQuantitySnapshot != null ? n(line.uomQuantitySnapshot) : null,
      uomConversionFactorSnapshot: line.uomConversionFactorSnapshot != null ? n(line.uomConversionFactorSnapshot) : null,
      purchaseUomCodeSnapshot: line.purchaseUomCodeSnapshot,
      uomCodeSnapshot: line.uomCodeSnapshot,
      rate: n(line.rate),
      amount: n(line.amount),
      taxRatePct: n(line.taxRatePct),
      lineTotal: n(line.lineTotal),
      purchaseOrderLineId: line.purchaseOrderLineId,
      goodsReceiptLineId: line.goodsReceiptLineId,
    }, null, 2))
  }

  if (po) {
    console.log('\n=== LINKED PO ===', po.orderNumber, po.status)
    for (const pl of po.lines) {
      console.log(JSON.stringify({
        lineNumber: pl.lineNumber,
        id: pl.id,
        itemCode: pl.itemCodeSnapshot,
        quantity: n(pl.quantity),
        uomQuantity: n(pl.uomQuantity),
        uomConversionFactor: n(pl.uomConversionFactor),
        rate: n(pl.rate),
        receivedQuantity: n(pl.receivedQuantity),
        invoicedQuantity: n(pl.invoicedQuantity),
      }, null, 2))
    }
  }

  if (grn) {
    console.log('\n=== LINKED GRN ===', grn.grnNumber, grn.status)
    for (const gl of grn.lines) {
      console.log(JSON.stringify({
        lineNumber: gl.lineNumber,
        id: gl.id,
        purchaseOrderLineId: gl.purchaseOrderLineId,
        itemCode: gl.itemCodeSnapshot,
        receivedQuantity: n(gl.receivedQuantity),
        receivedUomQuantity: n(gl.receivedUomQuantity),
        acceptedQuantity: n(gl.acceptedQuantity),
        acceptedUomQuantity: n(gl.acceptedUomQuantity),
        rate: n(gl.rate),
        toleranceStatus: gl.toleranceStatus,
        tolerancePercentage: n(gl.tolerancePercentage),
      }, null, 2))
    }
  }

  console.log('\n=== MATCH TOLERANCES (tenant setup) ===')
  console.log(JSON.stringify(setup, null, 2))

  console.log('\n=== STATUS HISTORY ===')
  for (const h of history) {
    console.log(
      `${h.createdAt.toISOString()} | ${h.action} | ${h.fromStatus ?? '—'} → ${h.toStatus}${h.remarks ? ` | ${h.remarks}` : ''}`,
    )
  }
  if (history.length === 0) console.log('(no history rows)')

  console.log('\n=== LINE-BY-LINE MATCH ANALYSIS ===')
  for (const line of inv.lines) {
    const poLine = line.purchaseOrderLineId
      ? po?.lines.find((l) => l.id === line.purchaseOrderLineId)
      : po?.lines.find((l) => l.itemCodeSnapshot === line.itemCodeSnapshot)
    const grnLine = line.goodsReceiptLineId
      ? grn?.lines.find((l) => l.id === line.goodsReceiptLineId)
      : grn?.lines.find((l) => l.itemCodeSnapshot === line.itemCodeSnapshot)

    const factor =
      n(line.uomConversionFactorSnapshot ?? poLine?.uomConversionFactor ?? grnLine?.uomConversionFactor ?? 1) || 1
    const expectedVendorQty = n(
      grnLine?.receivedUomQuantity ?? poLine?.uomQuantity ?? (factor === 1 ? grnLine?.receivedQuantity : n(grnLine?.receivedQuantity) * factor),
    )
    const invoiceVendorQty = n(
      line.uomQuantitySnapshot ?? (factor === 1 ? line.quantity : n(line.quantity) * factor),
    )
    const qtyPct = expectedVendorQty
      ? (Math.abs(invoiceVendorQty - expectedVendorQty) / expectedVendorQty) * 100
      : invoiceVendorQty
        ? Infinity
        : 0
    const qtyTol = n(setup?.quantityTolerancePct)

    console.log(`\nLine ${line.lineNumber} ${line.itemCodeSnapshot} — ${line.itemNameSnapshot}`)
    console.log(`  PO qty (stock): ${poLine ? n(poLine.quantity) : '—'}`)
    console.log(`  PO uom qty: ${poLine ? n(poLine.uomQuantity) : '—'}`)
    console.log(`  GRN received (stock): ${grnLine ? n(grnLine.receivedQuantity) : '—'}`)
    console.log(`  GRN receivedUomQuantity: ${grnLine ? n(grnLine.receivedUomQuantity) : '—'}`)
    console.log(`  Invoice qty (stock): ${n(line.quantity)}`)
    console.log(`  Invoice uomQuantitySnapshot: ${line.uomQuantitySnapshot != null ? n(line.uomQuantitySnapshot) : '—'}`)
    console.log(`  Match baseline (expected vendor qty): ${expectedVendorQty}`)
    console.log(`  Invoice vendor qty used: ${invoiceVendorQty}`)
    console.log(`  Qty variance: ${qtyPct.toFixed(4)}% (tolerance ${qtyTol}%)`)
    console.log(`  PO rate: ${poLine ? n(poLine.rate) : '—'} | Invoice rate: ${n(line.rate)}`)
    console.log(
      qtyPct > qtyTol
        ? `  RESULT: FAIL — quantity tolerance exceeded`
        : qtyPct > 0
          ? `  RESULT: within tolerance`
          : `  RESULT: exact match`,
    )
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
