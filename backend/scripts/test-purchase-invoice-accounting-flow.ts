/**
 * Live smoke: Purchase Invoice → Accounts (AP) flow.
 * Finds a billable GRN (inventory-posted, not yet invoiced), creates a
 * purchase invoice from it through the same service the frontend calls,
 * walks DRAFT → PENDING_APPROVAL → APPROVED → POSTED, then verifies the
 * AP handoff created an Accounting VendorInvoice draft linked back to the
 * purchase invoice and that PO invoiced quantities were incremented.
 */
import { prisma } from '../src/config/prisma.js'
import {
  approvePurchaseInvoice,
  createPurchaseInvoice,
  postPurchaseInvoice,
  submitPurchaseInvoice,
} from '../src/modules/purchase/invoices/purchase-invoice.service.js'

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!tenant) throw new Error('Tenant vasant-trailers not found')
  const actor = await prisma.user.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } })
  if (!actor) throw new Error('No user found for tenant')

  // GRNs already referenced by a live (non-cancelled) purchase invoice.
  const invoicedGrnIds = (
    await prisma.purchaseInvoice.findMany({
      where: { tenantId: tenant.id, goodsReceiptId: { not: null }, status: { not: 'CANCELLED' } },
      select: { goodsReceiptId: true },
    })
  ).map((r) => r.goodsReceiptId!) // filtered non-null above

  const grn = await prisma.goodsReceipt.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'INVENTORY_POSTED',
      ...(invoicedGrnIds.length ? { id: { notIn: invoicedGrnIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { lines: { include: { purchaseOrderLine: true } } },
  })
  if (!grn) throw new Error('No un-invoiced INVENTORY_POSTED GRN found — receive a PO first')

  // Billable base qty per line: after QC rejection only the accepted qty is payable.
  const billableLines = grn.lines
    .map((line) => {
      const rejected = num(line.rejectedQuantity)
      const baseQty = rejected > 0 ? num(line.acceptedQuantity) : num(line.receivedQuantity)
      return { line, baseQty }
    })
    .filter((entry) => entry.baseQty > 0 && entry.line.purchaseOrderLine)
  if (!billableLines.length) throw new Error(`GRN ${grn.grnNumber} has no billable lines`)

  console.log(`Using GRN ${grn.grnNumber} (PO ${grn.purchaseOrderId}) — ${billableLines.length} billable line(s)`)

  const created = await createPurchaseInvoice(tenant.id, actor.id, {
    vendorId: grn.vendorId,
    purchaseOrderId: grn.purchaseOrderId,
    goodsReceiptId: grn.id,
    vendorInvoiceNumber: `SMOKE-${Date.now()}`,
    lines: billableLines.map(({ line, baseQty }) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      goodsReceiptLineId: line.id,
      itemId: line.itemId,
      quantity: baseQty,
      rate: num(line.purchaseOrderLine!.rate),
      taxRatePct: num(line.purchaseOrderLine!.gstRatePctSnapshot),
    })),
  })
  console.log(
    `1. created ${created.invoiceNumber} status=${created.status} ` +
    `subtotal=${created.subtotalAmount} tax=${created.taxAmount} total=${created.totalAmount}`,
  )

  const submitted = await submitPurchaseInvoice(tenant.id, created.id, actor.id)
  console.log(`2. submitted status=${submitted.status} matching=${submitted.matchingStatus}`)

  const approved = await approvePurchaseInvoice(
    tenant.id, created.id, actor.id, {}, ['purchase.invoice.approve'],
  )
  console.log(`3. approved status=${approved.status}`)

  const posted = await postPurchaseInvoice(tenant.id, created.id, actor.id)
  console.log(`4. posted status=${posted.status}`)
  console.log('   AP handoff:', posted.apHandoff)

  // ── Verify the Accounts side ────────────────────────────────────────────────
  const pi = await prisma.purchaseInvoice.findFirstOrThrow({
    where: { id: created.id, tenantId: tenant.id },
    select: { vendorInvoiceId: true, vendorInvoiceDraftRef: true, status: true },
  })
  if (!pi.vendorInvoiceId) throw new Error('Purchase invoice has no vendorInvoiceId after posting')

  const vendorInvoice = await prisma.vendorInvoice.findFirstOrThrow({
    where: { id: pi.vendorInvoiceId, tenantId: tenant.id },
    include: { lines: true, sourceLinks: true },
  })
  console.log(
    `5. Accounting VendorInvoice ${vendorInvoice.draftReference} status=${vendorInvoice.status} ` +
    `supplierInv=${vendorInvoice.supplierInvoiceNumber} lines=${vendorInvoice.lines.length} ` +
    `sourceLinks=${vendorInvoice.sourceLinks.map((l) => l.sourceType).join(', ')}`,
  )
  if (vendorInvoice.lines.length !== billableLines.length) {
    throw new Error('VendorInvoice line count does not match purchase invoice lines')
  }

  // PO invoiced quantity moved by exactly the billed base qty.
  for (const { line, baseQty } of billableLines) {
    const poLine = await prisma.purchaseOrderLine.findFirstOrThrow({
      where: { id: line.purchaseOrderLineId!, tenantId: tenant.id },
      select: { invoicedQuantity: true, itemCodeSnapshot: true },
    })
    const before = num(line.purchaseOrderLine!.invoicedQuantity)
    const after = num(poLine.invoicedQuantity)
    console.log(`   PO line ${poLine.itemCodeSnapshot}: invoicedQty ${before} → ${after} (billed ${baseQty})`)
    if (Math.abs(after - (before + baseQty)) > 1e-6) {
      throw new Error(`PO line ${poLine.itemCodeSnapshot} invoicedQuantity did not increment correctly`)
    }
  }

  console.log('PASS — purchase invoice lifecycle verified; AP VendorInvoice draft created in Accounts')
  console.log(
    `Note: GL is posted from Accounting when the VendorInvoice draft (${vendorInvoice.draftReference}) ` +
    'is completed/posted there — Purchase never posts GL directly by design.',
  )
}

main()
  .catch((error) => {
    console.error('FAIL:', error instanceof Error ? error.message : error)
    if (error && typeof error === 'object' && 'details' in error) {
      console.error('Details:', JSON.stringify((error as { details: unknown }).details, null, 2))
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
