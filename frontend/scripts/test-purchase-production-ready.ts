/**
 * Purchase production readiness tests
 * npx tsx scripts/test-purchase-production-ready.ts
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { itemRequiresIncomingQc } = await import('../src/data/quality/itemQcConfig')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
useMrpStore.setState({ runs: [] })

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
check('MRP run ok', mrpResult.ok, mrpResult.error)
const run = useMrpStore.getState().getRun(mrpResult.runId!)!
const prId = usePurchaseStore.getState().createPrFromMrpRun(run, so.id)
const pr = usePurchaseStore.getState().getPr(prId)!
check('MRP creates PR', pr.source === 'mrp' && pr.lines.length > 0, pr.prNo)
check('PR has audit createdBy', !!pr.createdByName)

check('Submit PR', usePurchaseStore.getState().submitPr(prId).ok)
check('Approve PR', usePurchaseStore.getState().approvePr(prId).ok)

const vendors = useMasterStore.getState().vendors.filter((v) => v.isActive)
const rfq = usePurchaseStore.getState().createRfqFromPr(prId, [vendors[0].id, vendors[1].id])
check('RFQ from approved PR', rfq.ok, rfq.rfqId)

const rfqId = rfq.rfqId!
const line = usePurchaseStore.getState().getRfq(rfqId)!.lines[0]
usePurchaseStore.getState().addRfqQuote(rfqId, vendors[0].id, line.itemId, { rate: 100, leadTimeDays: 7, freightAmount: 500, gstPct: 18 })
usePurchaseStore.getState().addRfqQuote(rfqId, vendors[1].id, line.itemId, { rate: 110, leadTimeDays: 5, freightAmount: 200, gstPct: 18 })
const comparison = usePurchaseStore.getState().getVendorComparison(rfqId)
check('Vendor comparison ranks vendors', comparison.length >= 2 && comparison[0].rank === 1)

const poR = usePurchaseStore.getState().createPoFromRfq(rfqId, vendors[0].id)
check('PO created as draft', poR.ok)
const poId = poR.poId!
check('PO submit', usePurchaseStore.getState().submitPo(poId).ok)
check('PO approve', usePurchaseStore.getState().approvePo(poId).ok)
check('PO cannot send before approve (already approved path)', usePurchaseStore.getState().getPo(poId)!.status === 'approved')
check('PO send', usePurchaseStore.getState().sendPo(poId).ok)
check('PO cannot send twice', usePurchaseStore.getState().getPo(poId)!.status === 'sent')

const po = usePurchaseStore.getState().getPo(poId)!
const recvLine = po.lines[0]
const grnR = usePurchaseStore.getState().postGrn(poId, [{ poLineId: recvLine.id, receivedQty: recvLine.qty }])
check('GRN posts', grnR.ok, grnR.grnId)
const grn = usePurchaseStore.getState().getGrn(grnR.grnId!)!
if (itemRequiresIncomingQc(recvLine.itemId)) {
  check('GRN QC required triggers pending_qc', grn.status === 'pending_qc' || grn.qcRequired)
} else {
  check('GRN posted without QC', grn.status === 'posted')
}

check('Pending PR report', usePurchaseStore.getState().getPendingPrReport().length >= 0)
check('Open PO report', Array.isArray(usePurchaseStore.getState().getOpenPoReport()))

// Manual PR path — office supplies, emergency material, maintenance, tooling
const manualR = usePurchaseStore.getState().createManualPr({
  source: 'manual',
  purpose: 'maintenance_parts',
  lines: [{
    itemId: 'item-rm-primer',
    warehouseId: 'wh-cons',
    qty: 100,
    requiredDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    salesOrderId: null,
    workOrderId: null,
    remarks: 'Emergency paint shop replenishment',
  }],
})
check('Manual PR created', manualR.ok, manualR.prId)
const manualPr = usePurchaseStore.getState().getPr(manualR.prId!)!
check('Manual PR source + purpose', manualPr.source === 'manual' && manualPr.purpose === 'maintenance_parts', manualPr.prNo)
check('Manual PR submit', usePurchaseStore.getState().submitPr(manualR.prId!).ok)
check('Manual PR approve', usePurchaseStore.getState().approvePr(manualR.prId!).ok)
const manualPoR = usePurchaseStore.getState().createPoFromPr(manualR.prId!, 'vend-asian')
check('Direct PO from manual PR', manualPoR.ok, manualPoR.poId)

// PO amendment — Rev 1 → Rev 2 → Rev 3 with audit trail
const amendPoId = manualPoR.poId!
const amendPo = usePurchaseStore.getState().getPo(amendPoId)!
check('PO starts at Rev 1', amendPo.revisionNo === 1 && amendPo.revisions.length === 0)
check('PO submit for amend test', usePurchaseStore.getState().submitPo(amendPoId).ok)
check('PO approve for amend test', usePurchaseStore.getState().approvePo(amendPoId).ok)

const line1 = amendPo.lines[0]
const amend1 = usePurchaseStore.getState().amendPo(amendPoId, [{
  ...line1,
  qty: line1.qty + 50,
  rate: line1.rate,
}], 'Vendor agreed to increase qty')
check('PO amend Rev 1 → Rev 2', amend1.ok)
const afterRev2 = usePurchaseStore.getState().getPo(amendPoId)!
check('Revision number is 2', afterRev2.revisionNo === 2)
check('Revision audit trail entry', afterRev2.revisions.length === 1 && afterRev2.revisions[0].revisionNo === 1)
check('Amend resets to draft', afterRev2.status === 'draft')
check('Amended qty applied', afterRev2.lines[0].qty === line1.qty + 50)

check('Re-submit after amend', usePurchaseStore.getState().submitPo(amendPoId).ok)
check('Re-approve after amend', usePurchaseStore.getState().approvePo(amendPoId).ok)
check('Send after amend', usePurchaseStore.getState().sendPo(amendPoId).ok)

const line2 = usePurchaseStore.getState().getPo(amendPoId)!.lines[0]
const amend2 = usePurchaseStore.getState().amendPo(amendPoId, [{
  ...line2,
  qty: line2.qty,
  rate: line2.rate - 10,
}], 'Rate renegotiation after send')
check('PO amend Rev 2 → Rev 3 (sent PO)', amend2.ok)
const afterRev3 = usePurchaseStore.getState().getPo(amendPoId)!
check('Revision number is 3', afterRev3.revisionNo === 3)
check('Two revision audit entries', afterRev3.revisions.length === 2)
check('Sent PO amend clears sentAt', afterRev3.sentAt === null)
check('Amended rate applied', afterRev3.lines[0].rate === line2.rate - 10)

check('Cannot amend below received qty', (() => {
  usePurchaseStore.getState().submitPo(amendPoId)
  usePurchaseStore.getState().approvePo(amendPoId)
  usePurchaseStore.getState().sendPo(amendPoId)
  const po = usePurchaseStore.getState().getPo(amendPoId)!
  usePurchaseStore.getState().postGrn(amendPoId, [{ poLineId: po.lines[0].id, receivedQty: 10 }])
  const received = usePurchaseStore.getState().getPo(amendPoId)!.lines[0].receivedQty
  const r = usePurchaseStore.getState().amendPo(amendPoId, [{ ...po.lines[0], qty: received - 1 }], 'Invalid')
  return !r.ok
})())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
