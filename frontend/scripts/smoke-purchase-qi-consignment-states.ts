/**
 * Smoke: PR → RFQ → PO → three consignments with QI accept / reject / hold.
 * Demo domain service only (no GRN/QI backend yet).
 *
 * Run: npx tsx scripts/smoke-purchase-qi-consignment-states.ts
 */
import {
  acceptQualityInspection,
  approvePurchaseOrder,
  approvePurchaseRequisition,
  approveQuotationRecommendation,
  buildQuotationComparison,
  createGRNFromPo,
  createPurchaseOrderFromComparison,
  createPurchaseRequisition,
  createRFQ,
  createVendorQuotation,
  getGRNById,
  holdQualityInspection,
  recommendQuotationVendor,
  rejectQualityInspection,
  releasePurchaseOrder,
  resetPurchaseMockData,
  sendRFQ,
  submitGRN,
  submitPurchaseOrder,
  submitPurchaseRequisition,
  submitVendorQuotation,
  updateQuotationComparisonSelection,
} from '../src/services/purchase'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function approvePrUntilDone(id: string) {
  let cursor = await approvePurchaseRequisition(id, 'QI smoke')
  let guard = 0
  while (cursor.status === 'pending_approval' && guard < 5) {
    cursor = await approvePurchaseRequisition(cursor.id, `QI smoke L${guard}`)
    guard++
  }
  assert(cursor.status === 'approved', `PR not approved: ${cursor.status}`)
  return cursor
}

async function releasePo(poId: string) {
  let po = await submitPurchaseOrder(poId)
  let guard = 0
  while (po.status === 'pending_approval' && guard < 6) {
    try {
      po = await approvePurchaseOrder(po.id, `QI PO L${guard}`)
    } catch {
      break
    }
    guard++
  }
  if (po.status === 'approved') po = await releasePurchaseOrder(po.id)
  assert(
    ['released', 'partially_received'].includes(po.status),
    `PO not released: ${po.status}`,
  )
  return po
}

async function receiveConsignment(
  purchaseOrderId: string,
  lineId: string,
  qty: number,
  tag: string,
) {
  const grn = await createGRNFromPo({
    purchaseOrderId,
    warehouseId: 'wh-rm',
    warehouseName: 'RM Stores',
    vendorChallanNumber: `CH-${tag}`,
    vendorChallanDate: '2026-07-15',
    inspectionRequired: true,
    lines: [
      {
        purchaseOrderLineId: lineId,
        receivedQty: qty,
        warehouseId: 'wh-rm',
        warehouseName: 'RM Stores',
        batchNumber: `BATCH-${tag}`,
      },
    ],
  })
  const submitted = await submitGRN(grn.id)
  assert(submitted.status === 'pending_inspection', `GRN ${tag} not pending QI`)
  assert(submitted.qualityInspectionId, `GRN ${tag} missing QI`)
  return submitted
}

async function main() {
  await resetPurchaseMockData()
  console.log('=== QI consignment states: accept / reject / hold ===\n')

  console.log('1. PR → approve')
  const pr = await createPurchaseRequisition({
    department: 'Production',
    locationId: 'loc-chakan-rm',
    locationName: 'Chakan — Raw Material Stores',
    purpose: 'QI consignment state smoke',
    priority: 'normal',
    requisitionType: 'standard',
    source: 'manual',
    lines: [
      {
        itemId: 'pi-rm-hr-plate',
        quantity: 300,
        estimatedRate: 62,
        requiredDate: '2026-08-01',
      },
    ],
  })
  await submitPurchaseRequisition(pr.id)
  const approvedPr = await approvePrUntilDone(pr.id)
  console.log('  ', approvedPr.documentNumber, approvedPr.status)

  console.log('2. RFQ → VQ → compare → award → PO release')
  const rfq = await createRFQ({
    originMode: 'single_pr',
    purchaseRequisitionId: approvedPr.id,
    department: approvedPr.department,
    locationId: approvedPr.location.id,
    locationName: approvedPr.location.name,
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi'],
    lines: approvedPr.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      requiredDate: l.requiredDate,
      purchaseRequisitionId: approvedPr.id,
      prLineId: l.id,
    })),
  })
  await sendRFQ(rfq.id)

  for (const [vendorId, rate] of [
    ['pv-tata-steel', 61],
    ['pv-jsw-gi', 63],
  ] as const) {
    const draft = await createVendorQuotation({
      rfqId: rfq.id,
      vendorId,
      vendorReferenceNumber: `QI-${vendorId}`,
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOR Chakan',
      freightTerms: 'Included',
      warranty: '12 months',
      validTill: '2026-09-01',
      packingCharges: 100,
      lines: rfq.lines.map((l) => ({
        itemId: l.itemId,
        rfqLineId: l.id,
        quantity: l.quantity,
        rate,
        discountPct: 0,
        freightAllocation: 200,
        leadTimeDays: 14,
        technicalCompliance: 'compliant' as const,
        commercialCompliance: 'compliant' as const,
      })),
    })
    await submitVendorQuotation(draft.id)
  }

  const comparison = await buildQuotationComparison({
    rfqId: rfq.id,
    vendorIds: ['pv-tata-steel', 'pv-jsw-gi'],
    method: 'landed_cost',
  })
  await updateQuotationComparisonSelection(comparison.id, {
    selectionMode: 'all_lines',
    recommendedVendorId: 'pv-tata-steel',
    selectionReason: 'Lowest landed cost (QI smoke)',
  })
  await recommendQuotationVendor(comparison.id, {
    vendorId: 'pv-tata-steel',
    selectionReason: 'Lowest landed cost (QI smoke)',
  })
  await approveQuotationRecommendation(comparison.id)

  let po = await createPurchaseOrderFromComparison(comparison.id)
  po = await releasePo(po.id)
  const line = po.lines[0]
  assert(line, 'PO has no lines')
  console.log('  ', po.documentNumber, po.status, `openQty=${line.quantity}`)

  console.log('3. Three consignments (100 each) → QI outcomes')
  const grnAccept = await receiveConsignment(po.id, line.id, 100, 'ACCEPT')
  const grnReject = await receiveConsignment(po.id, line.id, 100, 'REJECT')
  const grnHold = await receiveConsignment(po.id, line.id, 100, 'HOLD')

  const accepted = await acceptQualityInspection(grnAccept.qualityInspectionId!, 100, 0)
  assert(accepted.status === 'accepted' || accepted.result === 'accepted', 'accept failed')
  assert(accepted.acceptedQty === 100 && accepted.rejectedQty === 0, 'accept qty mismatch')
  console.log('  ACCEPT', accepted.documentNumber, accepted.result, `acc=${accepted.acceptedQty}`)

  const rejected = await rejectQualityInspection(grnReject.qualityInspectionId!, 100)
  assert(rejected.result === 'rejected', `reject expected, got ${rejected.result}`)
  assert(rejected.rejectedQty === 100, 'reject qty mismatch')
  console.log('  REJECT', rejected.documentNumber, rejected.result, `rej=${rejected.rejectedQty}`)

  const held = await holdQualityInspection(grnHold.qualityInspectionId!, 'Await lab report')
  assert(held.status === 'hold' && held.result === 'hold', `hold expected, got ${held.status}/${held.result}`)
  console.log('  HOLD  ', held.documentNumber, held.result, held.remarks)

  const grnAfterHold = await getGRNById(grnHold.id)
  console.log('  HOLD GRN status after QI:', grnAfterHold?.status)

  console.log('\nok — accept / reject / hold consignments verified (demo domain)')
}

main().catch((err) => {
  console.error('FAIL', err)
  process.exit(1)
})
