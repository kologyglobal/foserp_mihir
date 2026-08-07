/**
 * Read-only probe: (1) which purchase documents are reflected in Accounts (GL /
 * vouchers / posting events / GST ledger), (2) tax-consistency checks on live docs.
 */
import { prisma } from '../src/config/prisma.js'

const TENANT_ID = '795be403-0588-4a81-b3ea-9f755f60c329'

function n(v: unknown) {
  return Number(v ?? 0)
}
function r2(x: number) {
  return Math.round(x * 100) / 100
}

async function main() {
  console.log('=== 1. GL reflection by source ===')
  const glBySource = await prisma.generalLedgerEntry.groupBy({
    by: ['sourceModule', 'sourceDocumentType'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('GL entries by source:', glBySource.length ? glBySource : '(none)')

  const vchBySource = await prisma.accountingVoucher.groupBy({
    by: ['sourceModule', 'sourceDocumentType', 'voucherType', 'status'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('Vouchers by source/type/status:', vchBySource.length ? vchBySource : '(none)')

  const postingEvents = await prisma.postingEvent.groupBy({
    by: ['sourceModule', 'sourceDocumentType', 'status'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('Posting events:', postingEvents.length ? postingEvents : '(none)')

  const gstLedger = await prisma.gstLedgerEntry.groupBy({
    by: ['documentType', 'direction'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('GST ledger entries by documentType:', gstLedger.length ? gstLedger : '(none)')

  console.log('\n=== 2. Doc counts (posted docs that SHOULD reflect) ===')
  const grnPosted = await prisma.goodsReceipt.count({
    where: { tenantId: TENANT_ID, status: { in: ['INVENTORY_POSTED', 'CLOSED'] } },
  })
  const invByStatus = await prisma.purchaseInvoice.groupBy({
    by: ['status'],
    where: { tenantId: TENANT_ID, deletedAt: null },
    _count: { _all: true },
  })
  const retByStatus = await prisma.purchaseReturn.groupBy({
    by: ['status'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('GRNs inventory-posted/closed:', grnPosted)
  console.log('Purchase invoices by status:', invByStatus)
  console.log('Purchase returns by status:', retByStatus)

  console.log('\n=== 3. Tax consistency: PO header vs lines ===')
  const pos = await prisma.purchaseOrder.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    select: {
      orderNumber: true,
      status: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
      freightAmount: true,
      lines: {
        select: {
          amount: true,
          gstRatePctSnapshot: true,
          cgstRateSnapshot: true,
          sgstRateSnapshot: true,
          igstRateSnapshot: true,
        },
      },
    },
  })
  let poIssues = 0
  for (const po of pos) {
    const lineAmt = r2(po.lines.reduce((s, l) => s + n(l.amount), 0))
    const lineTax = r2(
      po.lines.reduce((s, l) => s + r2((n(l.amount) * n(l.gstRatePctSnapshot)) / 100), 0),
    )
    const headerTax = r2(n(po.taxAmount))
    const subtotal = r2(n(po.subtotalAmount))
    const subDrift = Math.abs(lineAmt - subtotal) > 0.05
    const taxDrift = Math.abs(lineTax - headerTax) > 0.05
    const totalDrift =
      Math.abs(r2(subtotal + headerTax + n(po.freightAmount)) - n(po.totalAmount)) > 0.05
    const lineMixed = po.lines.some(
      (l) => n(l.igstRateSnapshot) > 0 && (n(l.cgstRateSnapshot) > 0 || n(l.sgstRateSnapshot) > 0),
    )
    // Rate-pct vs split mismatch: gstRatePct should equal igst or cgst+sgst
    const rateMismatch = po.lines.some((l) => {
      const pct = n(l.gstRatePctSnapshot)
      const split = n(l.igstRateSnapshot) || n(l.cgstRateSnapshot) + n(l.sgstRateSnapshot)
      return Math.abs(pct - split) > 0.01
    })
    if (subDrift || taxDrift || totalDrift || lineMixed || rateMismatch) {
      poIssues++
      console.log(`  ${po.orderNumber} [${po.status}]:`, {
        ...(subDrift ? { subtotal, lineAmt } : {}),
        ...(taxDrift ? { headerTax, lineTax } : {}),
        ...(totalDrift
          ? { subtotal, tax: headerTax, freight: n(po.freightAmount), total: n(po.totalAmount) }
          : {}),
        ...(lineMixed ? { lineMixedRates: true } : {}),
        ...(rateMismatch ? { rateSplitMismatch: true } : {}),
      })
    }
  }
  console.log(`  -> ${poIssues}/${pos.length} POs with header/line tax issues`)

  console.log('\n=== 4. Tax consistency: Purchase invoices ===')
  const invs = await prisma.purchaseInvoice.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    select: {
      invoiceNumber: true,
      status: true,
      gstScheme: true,
      placeOfSupplyStateCode: true,
      subtotalAmount: true,
      taxAmount: true,
      roundOffAmount: true,
      totalAmount: true,
      lines: {
        select: {
          amount: true,
          taxRatePct: true,
          taxAmount: true,
          cgstRateSnapshot: true,
          sgstRateSnapshot: true,
          igstRateSnapshot: true,
          gstSchemeSnapshot: true,
          lineTotal: true,
        },
      },
    },
  })
  let invIssues = 0
  for (const inv of invs) {
    const headerScheme = String(inv.gstScheme).toLowerCase()
    const schemeClash = inv.lines.some(
      (l) => l.gstSchemeSnapshot && l.gstSchemeSnapshot.toLowerCase() !== headerScheme,
    )
    const lineTaxSum = r2(inv.lines.reduce((s, l) => s + n(l.taxAmount), 0))
    const headerTax = r2(n(inv.taxAmount))
    const taxDrift = Math.abs(lineTaxSum - headerTax) > 0.05
    const lineTaxWrong = inv.lines.some(
      (l) => Math.abs(r2((n(l.amount) * n(l.taxRatePct)) / 100) - n(l.taxAmount)) > 0.02,
    )
    const expectedTotal = r2(n(inv.subtotalAmount) + headerTax + n(inv.roundOffAmount))
    const totalDrift = Math.abs(expectedTotal - n(inv.totalAmount)) > 0.05
    const rateMismatch = inv.lines.some((l) => {
      const pct = n(l.taxRatePct)
      const split = n(l.igstRateSnapshot) || n(l.cgstRateSnapshot) + n(l.sgstRateSnapshot)
      return split > 0 && Math.abs(pct - split) > 0.01
    })
    if (schemeClash || taxDrift || lineTaxWrong || totalDrift || rateMismatch) {
      invIssues++
      console.log(`  ${inv.invoiceNumber} [${inv.status}] scheme=${inv.gstScheme}:`, {
        ...(schemeClash ? { schemeClash: inv.lines.map((l) => l.gstSchemeSnapshot) } : {}),
        ...(taxDrift ? { headerTax, lineTaxSum } : {}),
        ...(lineTaxWrong ? { lineTaxWrong: true } : {}),
        ...(totalDrift ? { expectedTotal, total: n(inv.totalAmount) } : {}),
        ...(rateMismatch ? { rateSplitMismatch: true } : {}),
      })
    }
  }
  console.log(`  -> ${invIssues}/${invs.length} invoices with tax issues`)

  console.log('\n=== 5. Purchase return lines: tax + scheme ===')
  const rets = await prisma.purchaseReturn.findMany({
    where: { tenantId: TENANT_ID },
    select: {
      returnNumber: true,
      status: true,
      accountingStatus: true,
      vendorAdjustmentId: true,
      lines: {
        select: {
          returnQuantity: true,
          rate: true,
          amount: true,
          gstRatePctSnapshot: true,
          cgstRateSnapshot: true,
          sgstRateSnapshot: true,
          igstRateSnapshot: true,
          gstSchemeSnapshot: true,
        },
      },
    },
  })
  for (const ret of rets) {
    console.log(
      `  ${ret.returnNumber} [${ret.status}] accountingStatus=${ret.accountingStatus} vendorAdjustmentId=${ret.vendorAdjustmentId ?? '—'}`,
    )
    for (const [i, l] of ret.lines.entries()) {
      const mixed =
        n(l.igstRateSnapshot) > 0 && (n(l.cgstRateSnapshot) > 0 || n(l.sgstRateSnapshot) > 0)
      const expAmount = r2(n(l.returnQuantity) * n(l.rate))
      const amtDrift = Math.abs(expAmount - n(l.amount)) > 0.05
      const pct = n(l.gstRatePctSnapshot)
      const split = n(l.igstRateSnapshot) || n(l.cgstRateSnapshot) + n(l.sgstRateSnapshot)
      const rateMismatch = split > 0 && Math.abs(pct - split) > 0.01
      if (mixed || amtDrift || rateMismatch) {
        console.log(`    line ${i + 1}:`, {
          ...(mixed ? { mixedRates: true } : {}),
          ...(amtDrift ? { expAmount, amount: n(l.amount) } : {}),
          ...(rateMismatch ? { gstPct: pct, split, scheme: l.gstSchemeSnapshot } : {}),
        })
      }
    }
  }
  console.log(`  (checked ${rets.length} returns)`)

  console.log('\n=== 5b. Accounting handoff links ===')
  const invLinks = await prisma.purchaseInvoice.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    select: { invoiceNumber: true, status: true, vendorInvoiceId: true, vendorInvoiceDraftRef: true },
  })
  console.log('Invoice → Accounting VendorInvoice links:', invLinks)

  console.log('\n=== 6. Vendor GST profile vs invoice scheme ===')
  const vendors = await prisma.masterVendor.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    select: { id: true, name: true, gstin: true, state: true },
    take: 200,
  })
  const gstinPrefixByVendor = new Map(
    vendors.map((v) => [v.id, (v.gstin ?? '').slice(0, 2)]),
  )
  console.log(
    'Vendors with GSTIN:',
    vendors.filter((v) => (v.gstin ?? '').length >= 2).length,
    '/',
    vendors.length,
  )
  const invsWithVendor = await prisma.purchaseInvoice.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    select: { invoiceNumber: true, vendorId: true, gstScheme: true },
  })
  for (const inv of invsWithVendor) {
    const prefix = gstinPrefixByVendor.get(inv.vendorId) ?? ''
    console.log(`  ${inv.invoiceNumber}: scheme=${inv.gstScheme} vendorGstinPrefix=${prefix || '—'}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
