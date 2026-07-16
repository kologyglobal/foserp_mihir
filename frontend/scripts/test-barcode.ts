/**
 * Barcode & QR Traceability — Phase 1 integration tests
 * npm run test:barcode
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(key: string) {
    return mem.get(key) ?? null
  },
  setItem(key: string, value: string) {
    mem.set(key, value)
  },
  removeItem(key: string) {
    mem.delete(key)
  },
  key() {
    return null
  },
}

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useBarcodeStore } = await import('../src/store/barcodeStore')
const {
  ensureEntityBarcode,
  lookupBarcodeTrace,
  scanToIssue,
  scanToReceive,
  scanWipMove,
  scanSubcontractSend,
  scanSubcontractReceive,
  scanTrailer,
  scanDispatch,
} = await import('../src/utils/barcodeEngine')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

function reset() {
  useInventoryStore.setState({
    stockMovements: [...seedStockMovements],
    reservations: seedReservations.map((r) => ({ ...r })),
  })
  useMrpStore.setState({ runs: [] })
  usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
  useDispatchStore.setState({ dispatches: [] })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  useBarcodeStore.setState({ barcodes: [], history: [] })
}

function ensureStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'TEST-BC-INW',
      remarks: 'Barcode test inward',
    })
  }
}

function fillBooleanParams(
  results: { parameterType: string; passFailRule?: string; minValue?: number | null; targetValue?: number | null }[],
  pass = true,
) {
  return results.map((r) =>
    r.parameterType === 'boolean'
      ? { ...r, actualValue: r.passFailRule === 'boolean_false' ? !pass : pass }
      : r.parameterType === 'photo_required'
        ? { ...r, attachmentRef: pass ? 'photo-ref.jpg' : '', actualValue: pass ? 'photo-ref.jpg' : '' }
        : r.parameterType === 'numeric' && r.minValue != null
          ? { ...r, actualValue: r.targetValue ?? r.minValue }
          : r.parameterType === 'text'
            ? { ...r, actualValue: pass ? 'OK' : '' }
            : r.parameterType === 'dropdown'
              ? { ...r, actualValue: pass ? 'Acceptable' : 'Reject' }
              : r,
  )
}

function passPendingInspection(jobCardId: string) {
  const qStore = useQualityStore.getState()
  const pending = qStore.getPendingInspections().find((i) => i.jobCardId === jobCardId)
  if (!pending) return
  if (pending.parameterResults.length > 0) {
    qStore.recordInspectionDecision(pending.id, {
      inspector: 'Barcode QC',
      result: 'pass',
      remarks: 'Auto-pass barcode test',
      parameterResults: fillBooleanParams(pending.parameterResults, true),
      useAutoDecision: true,
    })
  } else {
    qStore.recordInspectionDecision(pending.id, {
      inspector: 'Barcode QC',
      result: 'pass',
      remarks: 'Auto-pass barcode test',
    })
  }
}

async function setupApprovedPo() {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
  check('MRP for PO path', mrpResult.ok, mrpResult.error)
  const run = useMrpStore.getState().getRun(mrpResult.runId!)!
  const prId = usePurchaseStore.getState().createPrFromMrpRun(run, so.id)
  usePurchaseStore.getState().submitPr(prId)
  usePurchaseStore.getState().approvePr(prId)
  const vendors = useMasterStore.getState().vendors.filter((v) => v.isActive)
  const rfq = usePurchaseStore.getState().createRfqFromPr(prId, [vendors[0].id, vendors[1].id])
  const rfqId = rfq.rfqId!
  const line = usePurchaseStore.getState().getRfq(rfqId)!.lines[0]
  usePurchaseStore.getState().addRfqQuote(rfqId, vendors[0].id, line.itemId, { rate: 100, leadTimeDays: 7, freightAmount: 500, gstPct: 18 })
  const poR = usePurchaseStore.getState().createPoFromRfq(rfqId, vendors[0].id)
  const poId = poR.poId!
  usePurchaseStore.getState().submitPo(poId)
  usePurchaseStore.getState().approvePo(poId)
  usePurchaseStore.getState().sendPo(poId)
  return { poId, so }
}

console.log('=== Barcode Traceability Phase 1 ===\n')
reset()

// ── 1. GRN barcode generation ──
console.log('── 1. GRN barcode generation ──')
const { poId } = await setupApprovedPo()
const po = usePurchaseStore.getState().getPo(poId)!
const poLine = po.lines[0]
const itemBarcode = useBarcodeStore.getState().generateBarcode({
  entityType: 'item',
  entityId: poLine.itemId,
  entityLabel: poLine.itemCode,
})

const receiveScan = scanToReceive({
  scan: itemBarcode.barcodeValue,
  poId,
  poLineId: poLine.id,
  receivedQty: poLine.qty,
})
check('Scan to receive posts GRN', receiveScan.ok, receiveScan.error)

const grn = usePurchaseStore.getState().grns[0]
const grnBarcode = grn ? ensureEntityBarcode('grn', grn.id, grn.grnNo) : null
check('GRN barcode generated', !!grnBarcode, grnBarcode?.barcodeValue)
check('GRN barcode entity type', grnBarcode?.entityType === 'grn')
check('GRN created event in history', useBarcodeStore.getState().getHistory(grnBarcode!.barcodeId).some((h) => h.eventType === 'created'))
check('Item received event logged', useBarcodeStore.getState().history.some((h) => h.eventType === 'received'))

// ── 2. Issue by scan ──
console.log('\n── 2. Issue by scan ──')
ensureStock(poLine.itemId, poLine.warehouseId, 5)
const issueQty = 2
const issue = scanToIssue({
  scan: itemBarcode.barcodeValue,
  warehouseId: poLine.warehouseId,
  qty: issueQty,
})
check('Scan to issue succeeds', issue.ok, issue.error)
check('Issue event logged', useBarcodeStore.getState().history.some((h) => h.eventType === 'issued' && h.barcodeId === itemBarcode.barcodeId))

// ── 3. WIP movement by scan ──
console.log('\n── 3. WIP movement by scan ──')
{
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  const soWip = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const mrpWip = useMrpStore.getState().runMrpForOrder(soWip.id, undefined, { autoReserve: false })
  useWorkOrderStore.getState().createFromMrpRun(mrpWip.runId!, soWip.id)
  const fgWip = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
  prepareFgMinimal(fgWip.id)
  const woBarcode = useBarcodeStore.getState().generateBarcode({
    entityType: 'work_order',
    entityId: fgWip.id,
    entityLabel: fgWip.woNo,
  })
  const wipMove = scanWipMove({ scan: woBarcode.barcodeValue })
  check('Scan WIP move / op start', wipMove.ok, wipMove.error)
  check('Moved event logged', useBarcodeStore.getState().history.some((h) => h.eventType === 'moved' && h.barcodeId === woBarcode.barcodeId))
}

function prepareFgMinimal(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  for (const child of store.workOrders.filter((w) => w.parentWoId === fgWoId && w.woType === 'manufactured_sub_assembly')) {
    store.planWorkOrder(child.id)
    store.releaseWorkOrder(child.id)
    for (const line of store.getWoMaterials(child.id)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
    store.reserveMaterials(child.id)
    store.issueAllReserved(child.id)
    store.completeWorkOrder(child.id)
    store.postSaReceipt(child.id)
  }
  for (const line of store.getWoMaterials(fgWoId)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
  store.planWorkOrder(fgWoId)
  store.releaseWorkOrder(fgWoId)
  store.reserveMaterials(fgWoId)
  store.issueAllReserved(fgWoId)
  store.startProduction(fgWoId)
}

function prepareFgForDispatch(fgWoId: string) {
  prepareFgMinimal(fgWoId)
  const store = useWorkOrderStore.getState()
  const qStore = useQualityStore.getState()
  for (const jc of store.getJobCards(fgWoId).sort((a, b) => a.sequenceNo - b.sequenceNo)) {
    store.startJobCard(jc.id, { assignedTeam: 'Barcode Dispatch Crew', startTime: '08:00' })
    const fresh = store.getJobCards(fgWoId).find((j) => j.id === jc.id)!
    store.completeJobCard(jc.id, {
      endTime: '17:00',
      actualHours: 2,
      remarks: 'Barcode dispatch prep',
      qcChecks: fresh.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    const pending = qStore.getPendingInspections().find((i) => i.jobCardId === jc.id)
    if (pending) passPendingInspection(jc.id)
  }
  store.completeWorkOrder(fgWoId)
  return store.postFgReceipt(fgWoId)
}

// ── 4. Subcontract send/receive by scan ──
console.log('\n── 4. Subcontract send/receive by scan ──')
const subWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')
const subLine = subWo ? useWorkOrderStore.getState().getWoMaterials(subWo.id)[0] : undefined
const vendor = useMasterStore.getState().vendors.find((v) => v.isActive)!

if (subWo && subLine) {
  ensureStock(subLine.itemId, subLine.warehouseId, subLine.requiredQty)
  const subBarcode = useBarcodeStore.getState().generateBarcode({
    entityType: 'work_order',
    entityId: subWo.id,
    entityLabel: subWo.woNo,
  })
  const send = scanSubcontractSend({
    scan: subBarcode.barcodeValue,
    woId: subWo.id,
    lineId: subLine.id,
    vendorId: vendor.id,
    challanNo: 'BC-SC-001',
    qty: subLine.requiredQty,
    expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  })
  check('Subcontract send by scan', send.ok, send.error)
  check('Subcontracted event logged', useBarcodeStore.getState().history.some((h) => h.eventType === 'subcontracted'))

  const shipment = useWorkOrderStore.getState().getSubcontractShipments(subWo.id)[0]
  const recv = scanSubcontractReceive({
    scan: subBarcode.barcodeValue,
    shipmentId: shipment.id,
    receivedQty: shipment.sentQty,
  })
  check('Subcontract receive by scan', recv.ok, recv.error)
  check('Receive event on subcontract', useBarcodeStore.getState().history.filter((h) => h.eventType === 'received').length >= 1)
} else {
  check('Subcontract send by scan', false, 'no subcontract WO')
  check('Subcontracted event logged', false)
  check('Subcontract receive by scan', false)
  check('Receive event on subcontract', false)
}

// ── 5. Dispatch by scan ──
console.log('\n── 5. Dispatch by scan ──')
useWorkOrderStore.setState({
  workOrders: [],
  materialLines: [],
  productionOperations: [],
  jobCards: [],
  subcontractShipments: [],
  fgReceipts: [],
  saReceipts: [],
  activities: [],
})
useDispatchStore.setState({ dispatches: [] })
useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })

const soDispatch = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrpDispatch = useMrpStore.getState().runMrpForOrder(soDispatch.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrpDispatch.runId!, soDispatch.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
const qStore = useQualityStore.getState()
const master = useMasterStore.getState()
const fgYard = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!

const fgReceipt = prepareFgForDispatch(fgWo.id)
check('FG receipt for dispatch', fgReceipt.ok, fgReceipt.error)

const fqc = qStore.createFinalInspection(fgWo.id)
check('Final QC created', fqc.ok, fqc.error)
qStore.recordFinalQcDecision(fqc.inspectionId!, { inspector: 'Barcode QC', result: 'pass', remarks: 'ok' })

check('FG stock in yard', useInventoryStore.getState().getOnHand(fgWo.fgItemId, fgYard!.id) >= fgWo.qty)
check('WO fg_received', useWorkOrderStore.getState().getWorkOrder(fgWo.id)?.status === 'fg_received')

const candidate = useDispatchStore.getState().getReadyCandidates().find((c) => c.workOrderId === fgWo.id)
const create = candidate ? useDispatchStore.getState().createDispatchPlan(candidate) : { ok: false as const, error: 'no candidate' }
check('Dispatch plan created', create.ok, create.error)
const plan = create.id ? useDispatchStore.getState().getDispatch(create.id)! : null

if (plan) {
  useDispatchStore.getState().updateLogistics(plan.id, {
    vehicleNo: 'MH-12-BC-001',
    lrNo: 'LR-BC-001',
    transporter: 'Barcode Transport',
    driverName: 'Driver',
    driverPhone: '9999999999',
  })
  for (const item of useDispatchStore.getState().getDispatch(plan.id)!.checklist) {
    if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(plan.id, item.id, true)
  }
  useDispatchStore.getState().addPhoto(plan.id, 'Loading', 'data:image/png;base64,iVBORw0KGgo=')
  useDispatchStore.getState().approveSecurityGate(plan.id)

  const line = plan.lines[0]
  const trailerBarcode = useBarcodeStore.getState().generateBarcode({
    entityType: 'trailer',
    entityId: `${plan.id}-${line.id}`,
    entityLabel: 'TRL-BC-001',
    trailerNo: 'TRL-BC-001',
    chassisNo: 'CH-BC-001',
  })

  const trailerScan = scanTrailer({
    scan: trailerBarcode.barcodeValue,
    dispatchId: plan.id,
    lineId: line.id,
  })
  check('Scan trailer links identity', trailerScan.ok, trailerScan.error)

  const dispatchScan = scanDispatch({ scan: trailerBarcode.barcodeValue, dispatchId: plan.id })
  check('Scan dispatch confirms plan', dispatchScan.ok, dispatchScan.error)
  check('Dispatched event logged', useBarcodeStore.getState().history.some((h) => h.eventType === 'dispatched'))
  check('Barcode marked consumed', useBarcodeStore.getState().getBarcode(trailerBarcode.barcodeId)?.status === 'consumed')
} else {
  check('Scan trailer links identity', false, 'no plan')
  check('Scan dispatch confirms plan', false)
  check('Dispatched event logged', false)
  check('Barcode marked consumed', false)
}

// ── 6. Traceability lookup ──
console.log('\n── 6. Traceability lookup ──')
const trailerBc = useBarcodeStore.getState().barcodes.find((b) => b.trailerNo === 'TRL-BC-001')
const byBarcode = lookupBarcodeTrace({ barcode: trailerBc?.barcodeValue })
check('Lookup by barcode value', !!byBarcode.barcode, byBarcode.barcode?.barcodeValue)
check('History includes dispatched', byBarcode.history.some((h) => h.eventType === 'dispatched'))

const byTrailer = lookupBarcodeTrace({ trailerNo: 'TRL-BC-001' })
check('Lookup by trailer no', !!byTrailer.barcode)

const byChassis = lookupBarcodeTrace({ chassisNo: 'CH-BC-001' })
check('Lookup by chassis no', !!byChassis.barcode)

console.log('\n═══════════════════════════════════════════════════════')
console.log(` Results: ${pass} passed, ${fail} failed`)
console.log(fail === 0 ? ' ALL BARCODE TESTS PASS' : ' BARCODE TESTS FAILED')
console.log('═══════════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
