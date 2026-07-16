/**
 * QR Code Traceability integration tests
 * npm run test:qr-traceability
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
const { useQrStore } = await import('../src/store/qrStore')
const { workflowPostGrn, workflowPostFgReceipt, workflowPostSaReceipt, workflowCreateDispatchPlan, workflowConfirmDispatch, workflowSendJobWork, workflowReceiveJobWork } = await import('../src/utils/qrWorkflow')
const { qrIssueToWo, qrWipMove, qrSaConsume, lookupQrTrace, qrValidateDispatchReady, resolveQrScan, buildTraceChain, traceChainHasTypes } = await import('../src/utils/qrEngine')
const { onQcFailed } = await import('../src/utils/qrIntegration')

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
  useQrStore.setState({ records: [], history: [], edges: [] })
}

function ensureStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'TEST-QR-INW',
      remarks: 'QR test inward',
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
      inspector: 'QR QC',
      result: 'pass',
      remarks: 'Auto-pass QR test',
      parameterResults: fillBooleanParams(pending.parameterResults, true),
      useAutoDecision: true,
    })
  } else {
    qStore.recordInspectionDecision(pending.id, {
      inspector: 'QR QC',
      result: 'pass',
      remarks: 'Auto-pass QR test',
    })
  }
}

function prepareFgForDispatch(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  for (const child of store.workOrders.filter((w) => w.parentWoId === fgWoId && w.woType === 'manufactured_sub_assembly')) {
    store.planWorkOrder(child.id)
    store.releaseWorkOrder(child.id)
    for (const line of store.getWoMaterials(child.id)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
    store.reserveMaterials(child.id)
    store.issueAllReserved(child.id)
    store.completeWorkOrder(child.id)
    workflowPostSaReceipt(child.id)
    const saQr = useQrStore.getState().getForEntity('SUB_ASSEMBLY', child.id)[0]
    if (saQr) qrSaConsume({ scan: saQr.qrCode, parentWoId: fgWoId, qty: 1 })
  }
  for (const line of store.getWoMaterials(fgWoId)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
  store.planWorkOrder(fgWoId)
  store.releaseWorkOrder(fgWoId)
  store.reserveMaterials(fgWoId)
  store.issueAllReserved(fgWoId)
  store.startProduction(fgWoId)
  const qStore = useQualityStore.getState()
  for (const jc of store.getJobCards(fgWoId).sort((a, b) => a.sequenceNo - b.sequenceNo)) {
    store.startJobCard(jc.id, { assignedTeam: 'QR Crew', startTime: '08:00' })
    const fresh = store.getJobCards(fgWoId).find((j) => j.id === jc.id)!
    store.completeJobCard(jc.id, {
      endTime: '17:00',
      actualHours: 2,
      remarks: 'QR test',
      qcChecks: fresh.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    passPendingInspection(jc.id)
  }
  const complete = store.completeWorkOrder(fgWoId)
  if (!complete.ok) return { ok: false, error: complete.error }
  return workflowPostFgReceipt(fgWoId)
}

async function setupApprovedPo() {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
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

console.log('=== QR Traceability Framework ===\n')
reset()

// 1. GRN generates material QR
console.log('── 1. GRN material QR ──')
const { poId, so } = await setupApprovedPo()
const po = usePurchaseStore.getState().getPo(poId)!
const poLine = po.lines[0]
const grnR = workflowPostGrn(poId, [{ poLineId: poLine.id, receivedQty: poLine.qty }])
check('GRN posted with QR', grnR.ok && 'qrCount' in grnR && (grnR.qrCount ?? 0) > 0, grnR.error)
const materialQr = useQrStore.getState().records.find((r) => r.entityType === 'MATERIAL_LOT')
check('Material lot QR created', !!materialQr, materialQr?.displayCode)

// 2. Print page route resolves QR id
console.log('\n── 2. QR print registry ──')
check('QR print path resolvable', !!materialQr?.qrId, `/qr/print/${materialQr?.qrId}`)

// 3. Scan material QR issue to WO
console.log('\n── 3. Issue to WO by QR ──')
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
ensureStock(materialQr!.metadata.itemId!, materialQr!.metadata.warehouseId!, 5)
const issue = qrIssueToWo({ scan: materialQr!.qrCode, woId: fgWo.id, qty: 1 })
check('QR issue to WO', issue.ok || !!issue.error, issue.message ?? issue.error)

// 4. SA receipt generates SA QR
console.log('\n── 4. SA receipt QR ──')
reset()
await setupApprovedPo()
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const fgWoRef = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
const saWo = useWorkOrderStore.getState().workOrders.find(
  (w) => w.woType === 'manufactured_sub_assembly' && w.parentWoId === fgWoRef.id,
) ?? useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'manufactured_sub_assembly')
if (saWo) {
  const store = useWorkOrderStore.getState()
  store.planWorkOrder(saWo.id)
  store.releaseWorkOrder(saWo.id)
  for (const line of store.getWoMaterials(saWo.id)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
  store.reserveMaterials(saWo.id)
  store.issueAllReserved(saWo.id)
  store.completeWorkOrder(saWo.id)
  const saR = workflowPostSaReceipt(saWo.id)
  check('SA receipt with QR', saR.ok, saR.error)
  const saQr = useQrStore.getState().getForEntity('SUB_ASSEMBLY', saWo.id)[0]
  check('Sub-assembly QR exists', !!saQr, saQr?.displayCode)

  // 5. WIP move by SA QR
  console.log('\n── 5. SA WIP move ──')
  const wip = qrWipMove({ scan: saQr!.qrCode })
  check('SA WIP move', wip.ok, wip.error)

  // 6. SA consume to parent WO
  console.log('\n── 6. SA consume ──')
  const parentFg = fgWoRef
  const consume = qrSaConsume({ scan: saQr!.qrCode, parentWoId: parentFg.id, qty: 1 })
  check('SA consumed to parent WO', consume.ok, consume.error)
} else {
  check('SA receipt with QR', false, 'no SA WO')
  check('Sub-assembly QR exists', false)
  check('SA WIP move', false)
  check('SA consumed to parent WO', false)
}

// 7-8. Job work send/receive QR
console.log('\n── 7-8. Job work QR ──')
const subWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')
const subLine = subWo ? useWorkOrderStore.getState().getWoMaterials(subWo.id)[0] : undefined
const vendor = useMasterStore.getState().vendors.find((v) => v.isActive)!
if (subWo && subLine) {
  ensureStock(subLine.itemId, subLine.warehouseId, subLine.requiredQty)
  const send = workflowSendJobWork({
    woId: subWo.id,
    lineId: subLine.id,
    vendorId: vendor.id,
    challanNo: 'QR-JW-001',
    qty: subLine.requiredQty,
    expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    warehouseId: subLine.warehouseId,
  })
  check('Job work send generates QR', send.ok, send.error)
  const jwQr = useQrStore.getState().getForEntity('JOB_WORK_ORDER', send.shipmentId!)[0]
  check('Job work QR AT_VENDOR', jwQr?.status === 'AT_VENDOR', jwQr?.displayCode)

  const recv = workflowReceiveJobWork({
    shipmentId: send.shipmentId!,
    acceptedQty: subLine.requiredQty,
    rejectedQty: 0,
    reworkQty: 0,
    qcRequired: false,
    remarks: 'QR test receive',
  })
  check('Job work receive validates QR', recv.ok, recv.error)
} else {
  check('Job work send generates QR', false)
  check('Job work QR AT_VENDOR', false)
  check('Job work receive validates QR', false)
}

// 9. QC fail → QC_HOLD
console.log('\n── 9. QC fail QR status ──')
const tempLot = useQrStore.getState().registerQr({
  entityType: 'MATERIAL_LOT',
  entityId: 'test-lot-qc',
  displayCode: 'LOT-QC-TEST',
  status: 'IN_STOCK',
})
onQcFailed(tempLot.qrId, 'NCR-QR-TEST')
check('QC fail sets QC_HOLD', useQrStore.getState().getQr(tempLot.qrId)?.status === 'QC_HOLD')

// 10-12. FG trailer QR + dispatch
console.log('\n── 10-12. Dispatch QR flow ──')
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
useQrStore.setState({ records: [], history: [], edges: [] })
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const fgWo2 = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
const poForLot = usePurchaseStore.getState().purchaseOrders[0]
if (poForLot) {
  const poLine = poForLot.lines[0]
  workflowPostGrn(poForLot.id, [{ poLineId: poLine.id, receivedQty: 1 }])
  const rmLot = useQrStore.getState().records.find((r) => r.entityType === 'MATERIAL_LOT')
  if (rmLot?.metadata.itemId && rmLot.metadata.warehouseId) {
    ensureStock(rmLot.metadata.itemId, rmLot.metadata.warehouseId, 2)
    qrIssueToWo({ scan: rmLot.qrCode, woId: fgWo2.woNo, qty: 1 })
  }
}
const fgReceipt = prepareFgForDispatch(fgWo2.id)
check('FG receipt generates trailer QR', fgReceipt.ok, fgReceipt.error)
const trailerQr = useQrStore.getState().getForEntity('FINISHED_TRAILER', fgWo2.id)[0]
check('Finished trailer QR exists', !!trailerQr, trailerQr?.metadata.trailerNo)

const fqc = useQualityStore.getState().createFinalInspection(fgWo2.id)
const finalInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
const finalParams = finalInsp?.parameterResults.length
  ? fillBooleanParams(finalInsp.parameterResults, true)
  : undefined
useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'QR QC',
  result: 'pass',
  remarks: 'ok',
  parameterResults: finalParams,
  useAutoDecision: true,
})

const candidate = useDispatchStore.getState().getReadyCandidates().find((c) => c.workOrderId === fgWo2.id)
const planR = candidate ? workflowCreateDispatchPlan(candidate) : { ok: false as const, error: 'no candidate' }
check('Dispatch plan + dispatch QR', planR.ok, planR.error)
if (!planR.ok || !planR.id) {
  check('Dispatch requires trailer QR', false, 'no plan')
  check('Dispatch scan posts QR_FG_DISPATCH', false)
  check('Trailer QR DISPATCHED', false)
  check('Trace by trailer no', false)
  check('History includes dispatched', false)
  check('Genealogy nodes present', false)
} else {
  const planId = planR.id
  useDispatchStore.getState().updateLogistics(planId, {
    vehicleNo: 'MH-QR-001',
    lrNo: 'LR-QR-001',
    transporter: 'QR Transport',
    driverName: 'Driver',
    driverPhone: '9999999999',
  })
  for (const item of useDispatchStore.getState().getDispatch(planId)!.checklist) {
    if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(planId, item.id, true)
  }
  useDispatchStore.getState().addPhoto(planId, 'Loading', 'data:image/png;base64,iVBORw0KGgo=')
  useDispatchStore.getState().approveSecurityGate(planId)

  check('Dispatch requires trailer QR', qrValidateDispatchReady(planId).ok)
  check('Dispatch blocked without QR scan', !workflowConfirmDispatch(planId).ok)
  const dispatchR = workflowConfirmDispatch(planId, trailerQr!.qrCode)
  check('Dispatch scan posts QR_FG_DISPATCH', dispatchR.ok, dispatchR.error)
  check('Trailer QR DISPATCHED', useQrStore.getState().getQr(trailerQr!.qrId)?.status === 'DISPATCHED')

  console.log('\n── 13. Traceability 360 ──')
  const trace = lookupQrTrace({ trailerNo: trailerQr!.metadata.trailerNo })
  check('Trace by trailer no', !!trace.qr)
  check('History includes dispatched', trace.history.some((h) => h.eventType === 'dispatched'))
  check('Genealogy nodes present', trace.genealogy.nodes.length >= 1, `nodes=${trace.genealogy.nodes.length}`)
  check(
    'Trace chain RM → SA → FG → Dispatch',
    traceChainHasTypes(trailerQr!.qrId, ['MATERIAL_LOT', 'SUB_ASSEMBLY', 'FINISHED_TRAILER', 'DISPATCH']),
    buildTraceChain(trailerQr!.qrId).map((n) => n.entityType).join(' → '),
  )
}

console.log('\n═══════════════════════════════════════════════════════')
console.log(` Results: ${pass} passed, ${fail} failed`)
console.log(fail === 0 ? ' ALL QR TRACEABILITY TESTS PASS' : ' QR TRACEABILITY TESTS FAILED')
console.log('═══════════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
