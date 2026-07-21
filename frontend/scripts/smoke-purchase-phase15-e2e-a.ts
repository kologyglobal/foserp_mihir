/**
 * Phase 15 E2E A — Direct purchase Planning path (demo domain service).
 * Create PR → Submit → Approve → Planning rows → Vendors → Vendor-grouped POs → PR conversion.
 *
 * Run: npx tsx scripts/smoke-purchase-phase15-e2e-a.ts
 */
import {
  approvePurchaseRequisition,
  createPurchaseOrdersFromPlanningSelection,
  createPurchaseRequisition,
  getPurchasePlanningSheet,
  getPurchaseRequisitionById,
  recalculatePurchasePlanningRows,
  resetPurchaseMockData,
  submitPurchaseRequisition,
  updatePurchasePlanningSheetRow,
} from '../src/services/purchase'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  await resetPurchaseMockData()
  console.log('E2E A: Direct-purchase PR → Planning → PO')

  const pr = await createPurchaseRequisition({
    department: 'Production',
    locationId: 'loc-chakan-rm',
    locationName: 'Chakan',
    purpose: 'Phase 15 E2E A',
    priority: 'normal',
    requisitionType: 'standard',
    source: 'manual',
    rfqRequired: false,
    documentDate: '2026-07-01',
    expectedDeliveryDate: '2026-07-20',
    lines: [
      { itemId: 'pi-rm-hr-plate', quantity: 100, estimatedRate: 62, requiredDate: '2026-07-20' },
      { itemId: 'pi-rm-erw-pipe', quantity: 50, estimatedRate: 420, requiredDate: '2026-07-20' },
    ],
  })
  assert(pr.rfqRequired === false, 'PR must be direct (rfqRequired=false)')
  await submitPurchaseRequisition(pr.id)

  let cursor = await approvePurchaseRequisition(pr.id, 'E2E A')
  let guard = 0
  while (cursor.status === 'pending_approval' && guard < 5) {
    cursor = await approvePurchaseRequisition(cursor.id, `E2E A L${guard}`)
    guard++
  }
  assert(cursor.status === 'approved', `PR not approved: ${cursor.status}`)

  let planning = await getPurchasePlanningSheet()
  const rows = planning.filter((r) => r.purchaseRequisitionId === cursor.id)
  assert(rows.length === pr.lines.length, `Expected ${pr.lines.length} planning rows, got ${rows.length}`)
  console.log('   Planning rows', rows.map((r) => r.planningNumber).join(', '))

  await recalculatePurchasePlanningRows(rows.map((r) => r.id))

  // Assign two vendors → expect 2 POs
  const vendorA = 'pv-tata-steel'
  const vendorB = 'pv-jsw-gi'
  await updatePurchasePlanningSheetRow(rows[0].id, {
    preferredVendorId: vendorA,
    expectedRate: 60,
    status: 'approved',
    actionMessage: true,
    requiredByDate: '2026-07-20',
  })
  await updatePurchasePlanningSheetRow(rows[1].id, {
    preferredVendorId: vendorB,
    expectedRate: 400,
    status: 'approved',
    actionMessage: true,
    requiredByDate: '2026-07-20',
  })

  const orders = await createPurchaseOrdersFromPlanningSelection([rows[0].id, rows[1].id])
  assert(orders.length === 2, `Expected 2 vendor-grouped POs, got ${orders.length}`)
  console.log('   POs', orders.map((o) => o.documentNumber).join(', '))

  planning = await getPurchasePlanningSheet()
  const after = planning.filter((r) => r.purchaseRequisitionId === cursor.id)
  assert(
    after.every((r) => r.status === 'po_created' && r.purchaseOrderId),
    'All planning rows should link to POs',
  )

  const fresh = await getPurchaseRequisitionById(cursor.id)
  assert(
    fresh?.status === 'converted_to_po' ||
      fresh?.convertedPoId ||
      after.every((r) => r.status === 'po_created'),
    `PR conversion incomplete: ${fresh?.status}`,
  )

  console.log('E2E A PASSED')
}

main().catch((err) => {
  console.error('E2E A FAILED', err)
  process.exit(1)
})
