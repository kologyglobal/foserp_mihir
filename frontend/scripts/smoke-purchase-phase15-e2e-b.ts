/**
 * Phase 15 E2E B — RFQ-required path (demo domain service).
 * Create RFQ PR → Approve → no Planning → RFQ → quotes → compare → award → PO.
 *
 * Run: npx tsx scripts/smoke-purchase-phase15-e2e-b.ts
 */
import {
  approvePurchaseRequisition,
  approveQuotationRecommendation,
  buildQuotationComparison,
  createPurchaseOrderFromComparison,
  createPurchaseRequisition,
  createRFQ,
  createVendorQuotation,
  getPurchasePlanningSheet,
  recommendQuotationVendor,
  resetPurchaseMockData,
  sendRFQ,
  submitPurchaseRequisition,
  submitVendorQuotation,
  updateQuotationComparisonSelection,
} from '../src/services/purchase'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  await resetPurchaseMockData()
  console.log('E2E B: RFQ-required PR → RFQ → Award → PO')

  const pr = await createPurchaseRequisition({
    department: 'Production',
    locationId: 'loc-chakan-rm',
    locationName: 'Chakan',
    purpose: 'Phase 15 E2E B',
    priority: 'normal',
    requisitionType: 'standard',
    source: 'manual',
    rfqRequired: true,
    documentDate: '2026-07-01',
    expectedDeliveryDate: '2026-07-20',
    lines: [
      { itemId: 'pi-rm-hr-plate', quantity: 200, estimatedRate: 62, requiredDate: '2026-07-20' },
    ],
  })
  assert(pr.rfqRequired === true, 'PR must require RFQ')
  await submitPurchaseRequisition(pr.id)

  let cursor = await approvePurchaseRequisition(pr.id, 'E2E B')
  let guard = 0
  while (cursor.status === 'pending_approval' && guard < 5) {
    cursor = await approvePurchaseRequisition(cursor.id, `E2E B L${guard}`)
    guard++
  }
  assert(cursor.status === 'approved', `PR not approved: ${cursor.status}`)

  const planning = await getPurchasePlanningSheet()
  const rows = planning.filter((r) => r.purchaseRequisitionId === cursor.id)
  assert(rows.length === 0, `RFQ PR must not create planning rows, got ${rows.length}`)
  console.log('   Planning rows after RFQ PR approve: 0')

  const rfq = await createRFQ({
    originMode: 'single_pr',
    purchaseRequisitionId: cursor.id,
    department: cursor.department,
    locationId: cursor.location.id,
    locationName: cursor.location.name,
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi'],
    lines: cursor.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      requiredDate: l.requiredDate,
      purchaseRequisitionId: cursor.id,
      prLineId: l.id,
    })),
  })
  await sendRFQ(rfq.id)

  const quote = async (vendorId: string, rate: number) => {
    const draft = await createVendorQuotation({
      rfqId: rfq.id,
      vendorId,
      vendorReferenceNumber: `E2E-B-${vendorId}`,
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOR',
      freightTerms: 'Included',
      warranty: '12 months',
      validTill: '2026-09-01',
      lines: rfq.lines.map((l) => ({
        rfqLineId: l.id,
        itemId: l.itemId,
        quantity: l.quantity,
        rate,
        leadTimeDays: 7,
      })),
    })
    await submitVendorQuotation(draft.id)
    return draft
  }

  await quote('pv-tata-steel', 58)
  await quote('pv-jsw-gi', 61)

  const cmp = await buildQuotationComparison({ rfqId: rfq.id, vendorIds: ['pv-tata-steel', 'pv-jsw-gi'] })
  await updateQuotationComparisonSelection(cmp.id, {
    selectedVendorId: 'pv-tata-steel',
  } as never)
  await recommendQuotationVendor(cmp.id, 'pv-tata-steel')
  await approveQuotationRecommendation(cmp.id, 'E2E B award')
  const po = await createPurchaseOrderFromComparison(cmp.id)
  assert(po?.id, 'PO should be created from award')
  console.log('   PO', po.documentNumber, po.status)

  console.log('E2E B PASSED')
}

main().catch((err) => {
  console.error('E2E B FAILED', err)
  process.exit(1)
})
