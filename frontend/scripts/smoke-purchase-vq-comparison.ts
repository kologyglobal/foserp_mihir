import {
  approveQuotationRecommendation,
  buildQuotationComparison,
  createPurchaseOrderFromComparison,
  createVendorQuotation,
  getQuotationComparison,
  getVendorQuotationList,
  recommendQuotationVendor,
  resetPurchaseMockData,
  submitVendorQuotation,
  updateQuotationComparisonSelection,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const list = await getVendorQuotationList()
  console.log(
    'list',
    list.map((r) => ({ no: r.documentNumber, status: r.status, rfq: r.rfqNumber, total: r.totalAmount })),
  )

  const draft = await createVendorQuotation({
    rfqId: 'prd-rfq-2001',
    vendorId: 'pv-apollo',
    vendorReferenceNumber: 'APL-TEST-1',
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOR Chakan',
    freightTerms: 'Included',
    warranty: '12 months',
    validTill: '2026-08-01',
    packingCharges: 500,
    lines: [
      {
        itemId: 'pi-rm-hr-plate',
        rfqLineId: 'prd-rfql-2001-1',
        quantity: 5000,
        rate: 62,
        discountPct: 0,
        freightAllocation: 1000,
        leadTimeDays: 14,
        technicalCompliance: 'compliant',
        commercialCompliance: 'compliant',
      },
    ],
  })
  console.log('created draft', draft.documentNumber, draft.totalAmount, draft.status)
  const submitted = await submitVendorQuotation(draft.id)
  console.log('submitted', submitted.status)

  const existing = await getQuotationComparison('prd-rfq-2001')
  console.log('seed comparison', existing?.documentNumber, existing?.recommendationStatus)

  const rebuilt = await buildQuotationComparison({
    rfqId: 'prd-rfq-2001',
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi'],
    method: 'landed_cost',
  })
  console.log(
    'rebuilt',
    rebuilt.documentNumber,
    rebuilt.rows[0]?.quotes.map((q) => ({
      v: q.vendorName,
      rate: q.rate,
      landed: q.landedAmount,
      lowBasic: q.isLowestBasic,
      lowLanded: q.isLowestLanded,
      preferred: q.isPreferred,
    })),
  )

  // Select non-lowest without reason → expect error
  try {
    await updateQuotationComparisonSelection(rebuilt.id, {
      selectionMode: 'all_lines',
      recommendedVendorId: 'pv-jsw-gi',
      selectionReason: '',
    })
    console.error('FAIL: expected SELECTION_REASON_REQUIRED')
    process.exit(1)
  } catch (err) {
    console.log('reason blocked', err instanceof Error ? err.message : err)
  }

  await updateQuotationComparisonSelection(rebuilt.id, {
    selectionMode: 'all_lines',
    recommendedVendorId: 'pv-jsw-gi',
    selectionReason: 'Lead time reliability outweighs landed cost',
  })
  const recommended = await recommendQuotationVendor(rebuilt.id, {
    vendorId: 'pv-jsw-gi',
    selectionReason: 'Lead time reliability outweighs landed cost',
  })
  console.log('recommended', recommended.recommendationStatus, recommended.recommendedVendorName)

  const approved = await approveQuotationRecommendation(rebuilt.id)
  console.log('approved', approved.recommendationStatus, approved.status)

  const po = await createPurchaseOrderFromComparison(rebuilt.id)
  console.log('po', po.documentNumber, po.vendor.name, po.totalAmount, po.lines.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
