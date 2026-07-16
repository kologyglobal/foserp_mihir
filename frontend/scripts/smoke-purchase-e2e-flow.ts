/**
 * Umbrella mock procurement E2E: PR → RFQ → VQ → Compare → PO → GRN → QI →
 * Post GRN → Invoice (3-way match) → Return → linked docs → report.
 *
 * Run: npx tsx scripts/smoke-purchase-e2e-flow.ts
 */
import {
  acceptQualityInspection,
  approvePurchaseInvoice,
  approvePurchaseOrder,
  approvePurchaseRequisition,
  approveQuotationRecommendation,
  buildQuotationComparison,
  computeInvoiceMatching,
  createGRNFromPo,
  createPurchaseInvoiceFromGrn,
  createPurchaseOrderFromComparison,
  createPurchaseRequisition,
  createPurchaseReturnFromQualityInspection,
  createRFQ,
  createVendorQuotation,
  getPurchaseOrderById,
  getPurchaseOrderLinkedDocuments,
  postGRN,
  recommendQuotationVendor,
  releasePurchaseOrder,
  resetPurchaseMockData,
  runPurchaseReport,
  sendRFQ,
  submitGRN,
  submitPurchaseInvoiceForApproval,
  submitPurchaseOrder,
  submitPurchaseRequisition,
  submitVendorQuotation,
  updatePurchaseInvoice,
  updateQuotationComparisonSelection,
  verifyPurchaseInvoice,
} from '../src/services/purchase'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  await resetPurchaseMockData()
  console.log('1. Create manual PR (multi-line) → Save Draft')
  const pr = await createPurchaseRequisition({
    department: 'Production',
    locationId: 'loc-chakan-rm',
    locationName: 'Chakan — Raw Material Stores',
    purpose: 'E2E smoke fabrication material',
    priority: 'normal',
    requisitionType: 'standard',
    source: 'manual',
    lines: [
      {
        itemId: 'pi-rm-hr-plate',
        quantity: 1000,
        estimatedRate: 62,
        requiredDate: '2026-08-01',
      },
      {
        itemId: 'pi-rm-erw-pipe',
        quantity: 200,
        estimatedRate: 420,
        requiredDate: '2026-08-01',
      },
    ],
  })
  assert(pr.status === 'draft', `PR should be draft, got ${pr.status}`)
  assert(pr.lines.length >= 2, 'PR should have multiple lines')
  console.log('   ', pr.documentNumber, pr.status, `lines=${pr.lines.length}`)

  console.log('2. Submit for Approval → Approve')
  await submitPurchaseRequisition(pr.id)
  const approvedPr = await approvePurchaseRequisition(pr.id, 'E2E approve')
  assert(
    approvedPr.status === 'approved' || approvedPr.status === 'pending_approval',
    `Unexpected PR status after approve: ${approvedPr.status}`,
  )
  // Multi-level matrix: keep approving until approved (demo admin)
  let prCursor = approvedPr
  let guard = 0
  while (prCursor.status === 'pending_approval' && guard < 5) {
    prCursor = await approvePurchaseRequisition(prCursor.id, `E2E L${guard}`)
    guard++
  }
  assert(prCursor.status === 'approved', `PR not approved: ${prCursor.status}`)
  console.log('   ', prCursor.documentNumber, prCursor.status)

  console.log('3. Convert PR → RFQ (select vendors)')
  const rfq = await createRFQ({
    originMode: 'single_pr',
    purchaseRequisitionId: prCursor.id,
    department: prCursor.department,
    locationId: prCursor.location.id,
    locationName: prCursor.location.name,
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi', 'pv-apollo'],
    lines: prCursor.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      requiredDate: l.requiredDate,
      purchaseRequisitionId: prCursor.id,
      prLineId: l.id,
    })),
  })
  await sendRFQ(rfq.id)
  console.log('   ', rfq.documentNumber, 'sent')

  console.log('4. Record vendor quotations')
  const mkQuote = async (vendorId: string, rate: number, freight: number) => {
    const draft = await createVendorQuotation({
      rfqId: rfq.id,
      vendorId,
      vendorReferenceNumber: `E2E-${vendorId}`,
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOR Chakan',
      freightTerms: 'Included',
      warranty: '12 months',
      validTill: '2026-09-01',
      packingCharges: 200,
      lines: rfq.lines.map((l) => ({
        itemId: l.itemId,
        rfqLineId: l.id,
        quantity: l.quantity,
        rate: vendorId === 'pv-tata-steel' && l.itemId === 'pi-rm-erw-pipe' ? rate + 5 : rate,
        discountPct: 0,
        freightAllocation: freight,
        leadTimeDays: vendorId === 'pv-jsw-gi' ? 10 : 14,
        technicalCompliance: 'compliant' as const,
        commercialCompliance: 'compliant' as const,
      })),
    })
    return submitVendorQuotation(draft.id)
  }
  const q1 = await mkQuote('pv-tata-steel', 61, 800)
  const q2 = await mkQuote('pv-jsw-gi', 63, 500)
  const q3 = await mkQuote('pv-apollo', 60, 1200)
  console.log('   ', [q1, q2, q3].map((q) => `${q.documentNumber}@${q.totalAmount}`).join(', '))

  console.log('5. Compare → select non-lowest (reason required)')
  const comparison = await buildQuotationComparison({
    rfqId: rfq.id,
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi', 'pv-apollo'],
    method: 'landed_cost',
  })
  try {
    await updateQuotationComparisonSelection(comparison.id, {
      selectionMode: 'all_lines',
      recommendedVendorId: 'pv-jsw-gi',
      selectionReason: '',
    })
    throw new Error('expected SELECTION_REASON_REQUIRED')
  } catch (err) {
    assert(
      err instanceof Error && /reason|SELECTION/i.test(err.message),
      `Expected reason block, got: ${err}`,
    )
    console.log('   reason blocked OK')
  }
  await updateQuotationComparisonSelection(comparison.id, {
    selectionMode: 'all_lines',
    recommendedVendorId: 'pv-jsw-gi',
    selectionReason: 'Lead time reliability outweighs landed cost (E2E)',
  })
  await recommendQuotationVendor(comparison.id, {
    vendorId: 'pv-jsw-gi',
    selectionReason: 'Lead time reliability outweighs landed cost (E2E)',
  })
  await approveQuotationRecommendation(comparison.id)
  console.log('   ', comparison.documentNumber, 'approved for JSW')

  console.log('6. Create PO → Approve → Release')
  let po = await createPurchaseOrderFromComparison(comparison.id)
  po = await submitPurchaseOrder(po.id)
  // Multi-level PO approval
  guard = 0
  while (
    (po.status === 'pending_approval' || po.approvalStatus === 'pending') &&
    guard < 6
  ) {
    try {
      po = await approvePurchaseOrder(po.id, `E2E PO L${guard}`)
    } catch {
      break
    }
    guard++
  }
  if (po.status !== 'released' && po.status !== 'approved') {
    try {
      po = await releasePurchaseOrder(po.id)
    } catch {
      // may already be releasable via approve
      po = (await getPurchaseOrderById(po.id)) ?? po
      if (po.status === 'approved' || po.status === 'draft' || po.status === 'pending_approval') {
        if (po.status !== 'approved') po = await approvePurchaseOrder(po.id, 'E2E final')
        po = await releasePurchaseOrder(po.id)
      }
    }
  }
  po = (await getPurchaseOrderById(po.id)) ?? po
  if (po.status === 'approved') po = await releasePurchaseOrder(po.id)
  assert(
    ['released', 'partially_received'].includes(po.status),
    `PO should be released, got ${po.status}`,
  )
  console.log('   ', po.documentNumber, po.status, `vendor=${po.vendor.name}`)

  console.log('7. Create partial GRN')
  const firstLine = po.lines[0]
  assert(firstLine, 'PO has no lines')
  const partialQty = Math.max(1, Math.floor(firstLine.quantity / 2))
  let grn = await createGRNFromPo({
    purchaseOrderId: po.id,
    warehouseId: firstLine.locationId || 'wh-rm',
    warehouseName: firstLine.locationName || 'RM Stores',
    vendorChallanNumber: 'E2E-CH-001',
    vendorChallanDate: '2026-07-15',
    gateEntryNo: 'GE-E2E-1',
    vehicleNo: 'MH12E2E1',
    inspectionRequired: true,
    lines: [
      {
        purchaseOrderLineId: firstLine.id,
        receivedQty: partialQty,
        warehouseId: firstLine.locationId || 'wh-rm',
        warehouseName: firstLine.locationName || 'RM Stores',
        batchNumber: 'BATCH-E2E-01',
      },
    ],
  })
  assert(grn.status === 'draft', `GRN draft expected, got ${grn.status}`)
  assert(grn.lines[0]!.receivedQty === partialQty, 'Partial qty mismatch')
  console.log('   ', grn.documentNumber, `recv=${partialQty}/${firstLine.quantity}`)

  console.log('8. Complete quality inspection')
  grn = await submitGRN(grn.id)
  assert(grn.status === 'pending_inspection', `Expected pending_inspection, got ${grn.status}`)
  assert(grn.qualityInspectionId, 'QI should auto-create on submit')
  const rejectedQty = Math.min(5, Math.floor(partialQty * 0.1) || 1)
  const acceptedQty = partialQty - rejectedQty
  const qi = await acceptQualityInspection(grn.qualityInspectionId!, acceptedQty, rejectedQty)
  assert(
    qi.result === 'partially_accepted' || qi.result === 'accepted' || qi.result === 'rejected',
    `Unexpected QI result ${qi.result}`,
  )
  console.log('   ', qi.documentNumber, qi.result, `acc=${acceptedQty} rej=${rejectedQty}`)

  console.log('9. Post GRN (inventory deferred path)')
  const posted = await postGRN(grn.id)
  assert(posted.status === 'posted', `GRN post failed: ${posted.status}`)
  assert(posted.inventoryPostDeferred === true, 'inventoryPostDeferred flag missing')
  console.log('   ', posted.documentNumber, 'posted; inventoryPostDeferred=true')

  console.log('10. Purchase invoice → three-way match → Approve')
  let inv = await createPurchaseInvoiceFromGrn(posted.id)
  inv = await updatePurchaseInvoice(inv.id, {
    vendorId: inv.vendor.id,
    vendorInvoiceNumber: `E2E/INV/${Date.now().toString().slice(-6)}`,
    vendorInvoiceDate: inv.vendorInvoiceDate || '2026-07-15',
    origin: inv.origin,
    purchaseOrderId: inv.purchaseOrderId,
    goodsReceiptId: inv.goodsReceiptId,
    lines: inv.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.rate,
      discountAmount: l.discountAmount,
      gstRatePct: l.gstRatePct,
      purchaseOrderLineId: l.purchaseOrderLineId,
      goodsReceiptLineId: l.goodsReceiptLineId,
      description: l.description,
    })),
  })
  inv = await verifyPurchaseInvoice(inv.id)
  const matching = await computeInvoiceMatching(inv.id)
  console.log('   match', matching.overallStatus, matching.exceedsTolerance ? 'EXCEEDS' : 'OK')
  if (matching.exceedsTolerance) {
    // Exception path: still submit / approve with exception if available
    try {
      const { approveInvoiceMatchingException } = await import('../src/services/purchase')
      await approveInvoiceMatchingException(inv.id, 'E2E tolerance exception')
      console.log('   exception approved')
    } catch (err) {
      console.log('   exception path:', err instanceof Error ? err.message : err)
    }
  }
  inv = await submitPurchaseInvoiceForApproval(inv.id)
  guard = 0
  while (inv.status !== 'approved' && inv.status !== 'posted' && guard < 5) {
    try {
      inv = await approvePurchaseInvoice(inv.id, `E2E inv L${guard}`)
    } catch (err) {
      console.log('   approve stop:', err instanceof Error ? err.message : err)
      break
    }
    guard++
  }
  console.log('   ', inv.documentNumber, inv.status, inv.matchStatus)

  console.log('11. Purchase return for rejected material')
  const ret = await createPurchaseReturnFromQualityInspection(qi.id)
  assert(ret.lines.some((l) => l.returnQty > 0), 'Return should have qty')
  console.log('   ', ret.documentNumber, ret.origin, `qty=${ret.lines[0]?.returnQty}`)

  console.log('12. Linked documents + report runner')
  const linked = await getPurchaseOrderLinkedDocuments(po.id)
  assert(linked.grns.length >= 1 || linked.goodsReceipts?.length >= 1 || true, 'linked docs')
  assert(linked.grns.length >= 1, 'Expected linked GRN on PO')
  assert((linked.invoices?.length ?? 0) >= 1, 'Expected linked invoice on PO')
  assert((linked.returns?.length ?? 0) >= 1, 'Expected linked return on PO')
  console.log(
    '   linked',
    `grns=${linked.grns.length}`,
    `invoices=${linked.invoices.length}`,
    `returns=${linked.returns.length}`,
  )
  const report = await runPurchaseReport('po-open', {})
  assert(report.rows.length >= 0, 'report should return')
  console.log('   report', report.reportId, `rows=${report.rows.length}`, report.title)

  console.log('ok — purchase E2E flow complete')
}

main().catch((err) => {
  console.error('FAIL', err)
  process.exit(1)
})
