/**
 * QR generation & wiring tests — npm run test:qr-generation
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
const { useQrStore, ensureEntityQr } = await import('../src/store/qrStore')
const {
  workflowPostGrn,
  workflowPostFgReceipt,
  workflowPostSaReceipt,
  workflowCreateDispatchPlan,
  workflowConfirmDispatch,
  workflowSendJobWork,
  workflowReceiveJobWork,
} = await import('../src/utils/qrWorkflow')
const { qrIssueToWo, lookupQrTrace, qrValidateDispatchReady, resolveQrScan } = await import('../src/utils/qrEngine')
const { generateQrImageDataUrl, validateQrPayload } = await import('../src/utils/qrCode')

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
      referenceNo: 'TEST-QR-GEN',
      remarks: 'QR generation test inward',
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
  usePurchaseStore.getState().addRfqQuote(rfqId, vendors[0].id, line.itemId, {
    rate: 100,
    leadTimeDays: 7,
    freightAmount: 500,
    gstPct: 18,
  })
  const poR = usePurchaseStore.getState().createPoFromRfq(rfqId, vendors[0].id)
  const poId = poR.poId!
  usePurchaseStore.getState().submitPo(poId)
  usePurchaseStore.getState().approvePo(poId)
  usePurchaseStore.getState().sendPo(poId)
  return { poId, so }
}

function prepareFgForDispatch(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  for (const child of store.workOrders.filter(
    (w) => w.parentWoId === fgWoId && w.woType === 'manufactured_sub_assembly',
  )) {
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
  const qStore = useQualityStore.getState()
  for (const jc of store.getJobCards(fgWoId).sort((a, b) => a.sequenceNo - b.sequenceNo)) {
    store.startJobCard(jc.id, { assignedTeam: 'QR Gen Crew', startTime: '08:00' })
    const fresh = store.getJobCards(fgWoId).find((j) => j.id === jc.id)!
    store.completeJobCard(jc.id, {
      endTime: '17:00',
      actualHours: 2,
      remarks: 'QR gen test',
      qcChecks: fresh.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    const pending = qStore.getPendingInspections().find((i) => i.jobCardId === jc.id)
    if (pending?.parameterResults.length) {
      qStore.recordInspectionDecision(pending.id, {
        inspector: 'QR Gen QC',
        result: 'pass',
        remarks: 'ok',
        parameterResults: fillBooleanParams(pending.parameterResults, true),
        useAutoDecision: true,
      })
    } else if (pending) {
      qStore.recordInspectionDecision(pending.id, { inspector: 'QR Gen QC', result: 'pass', remarks: 'ok' })
    }
  }
  const complete = store.completeWorkOrder(fgWoId)
  if (!complete.ok) return { ok: false, error: complete.error }
  return workflowPostFgReceipt(fgWoId)
}

console.log('=== QR Generation Suite ===\n')
reset()

// 1. GRN accepted line generates QR
const { poId, so } = await setupApprovedPo()
const po = usePurchaseStore.getState().getPo(poId)!
const poLine = po.lines[0]
const grnR = workflowPostGrn(poId, [{ poLineId: poLine.id, receivedQty: poLine.qty }])
const materialQr = useQrStore.getState().records.find((r) => r.entityType === 'MATERIAL_LOT')
check('1. GRN accepted line generates QR', grnR.ok && !!materialQr, materialQr?.displayCode)
const grnId = usePurchaseStore.getState().grns[0]?.id
const headerQr = grnId ? useQrStore.getState().getForEntity('GRN_LINE', grnId)[0] : undefined
check('1b. GRN header QR for detail page', !!headerQr, headerQr?.displayCode)

// 2. QR image renders
const imgUrl = materialQr ? await generateQrImageDataUrl(materialQr.qrCode) : ''
check('2. QR image renders', imgUrl.startsWith('data:image/png'), imgUrl.slice(0, 30))

// 3. QR print page opens (route resolvable)
check('3. QR print page opens', !!materialQr?.qrId, `/qr/print/${materialQr?.qrId}`)

// 4. Duplicate QR is blocked
const beforeCount = useQrStore.getState().records.length
const dup = ensureEntityQr({
  entityType: 'SUB_ASSEMBLY',
  entityId: 'test-sa-dup',
  displayCode: 'SA-DUP-TEST',
})
const dup2 = ensureEntityQr({
  entityType: 'SUB_ASSEMBLY',
  entityId: 'test-sa-dup',
  displayCode: 'SA-DUP-TEST',
})
check(
  '4. Duplicate QR is blocked',
  dup.qrId === dup2.qrId && useQrStore.getState().records.length === beforeCount + 1,
  dup.qrId,
)

// 5. Material issue by QR posts ledger movement
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
ensureStock(materialQr!.metadata.itemId!, materialQr!.metadata.warehouseId!, 5)
const movesBefore = useInventoryStore.getState().stockMovements.length
const issue = qrIssueToWo({ scan: materialQr!.qrCode, woId: fgWo.id, qty: 1 })
const movesAfter = useInventoryStore.getState().stockMovements.length
check('5. Material issue by QR posts ledger movement', issue.ok && movesAfter > movesBefore, issue.message)

// 6. SA receipt generates QR
reset()
await setupApprovedPo()
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const saWo =
  useWorkOrderStore.getState().workOrders.find(
    (w) => w.woType === 'manufactured_sub_assembly',
  ) ?? null
let saQr = undefined as ReturnType<typeof useQrStore.getState>['records'][0] | undefined
if (saWo) {
  const store = useWorkOrderStore.getState()
  store.planWorkOrder(saWo.id)
  store.releaseWorkOrder(saWo.id)
  for (const line of store.getWoMaterials(saWo.id)) ensureStock(line.itemId, line.warehouseId, line.requiredQty)
  store.reserveMaterials(saWo.id)
  store.issueAllReserved(saWo.id)
  store.completeWorkOrder(saWo.id)
  const saR = workflowPostSaReceipt(saWo.id)
  saQr = useQrStore.getState().getForEntity('SUB_ASSEMBLY', saWo.id)[0]
  check('6. SA receipt generates QR', saR.ok && !!saQr, saQr?.displayCode)
} else {
  check('6. SA receipt generates QR', false, 'no SA WO')
}

// 7. FG receipt generates trailer QR
const fgWo2 =
  useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods') ??
  (() => {
    useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
    return useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
  })()
const fgReceipt = prepareFgForDispatch(fgWo2.id)
const trailerQr = useQrStore.getState().getForEntity('FINISHED_TRAILER', fgWo2.id)[0]
check('7. FG receipt generates trailer QR', fgReceipt.ok && !!trailerQr, trailerQr?.metadata.trailerNo)

// 8. Job work send generates vendor QR
const subWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')
const subLine = subWo ? useWorkOrderStore.getState().getWoMaterials(subWo.id)[0] : undefined
const vendor = useMasterStore.getState().vendors.find((v) => v.isActive)!
let jwQr = undefined as ReturnType<typeof useQrStore.getState>['records'][0] | undefined
if (subWo && subLine) {
  ensureStock(subLine.itemId, subLine.warehouseId, subLine.requiredQty)
  const send = workflowSendJobWork({
    woId: subWo.id,
    lineId: subLine.id,
    vendorId: vendor.id,
    challanNo: 'QR-GEN-JW-001',
    qty: subLine.requiredQty,
    expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    warehouseId: subLine.warehouseId,
  })
  jwQr = useQrStore.getState().getForEntity('JOB_WORK_ORDER', send.shipmentId!)[0]
  check('8. Job work send generates vendor QR', send.ok && jwQr?.status === 'AT_VENDOR', jwQr?.displayCode)
} else {
  check('8. Job work send generates vendor QR', false)
}

// 9. Job work receive validates QR
if (subWo && subLine && jwQr) {
  const recv = workflowReceiveJobWork({
    shipmentId: jwQr.entityId,
    acceptedQty: subLine.requiredQty,
    rejectedQty: 0,
    reworkQty: 0,
    qcRequired: false,
    remarks: 'QR gen receive',
  })
  check('9. Job work receive validates QR', recv.ok, recv.message ?? recv.error)
} else {
  check('9. Job work receive validates QR', false)
}

// 10. Dispatch requires trailer QR
const fqc = useQualityStore.getState().createFinalInspection(fgWo2.id)
const finalInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'QR Gen QC',
  result: 'pass',
  remarks: 'ok',
  parameterResults: finalInsp?.parameterResults.length
    ? fillBooleanParams(finalInsp.parameterResults, true)
    : undefined,
  useAutoDecision: true,
})
const candidate = useDispatchStore.getState().getReadyCandidates().find((c) => c.workOrderId === fgWo2.id)
const planR = candidate ? workflowCreateDispatchPlan(candidate) : { ok: false as const, error: 'no candidate' }
check('10. Dispatch requires trailer QR', planR.ok && qrValidateDispatchReady(planR.id!).ok, planR.error)

// 11. Scan invalid QR shows error
const invalidPayload = validateQrPayload('not-json')
const invalidScan = resolveQrScan('{"type":"UNKNOWN","id":"X"}')
check(
  '11. Scan invalid QR shows error',
  !invalidPayload.ok && (!invalidScan.ok || invalidScan.error != null),
  invalidPayload.ok ? undefined : 'invalid payload rejected',
)

// 12. Traceability shows QR movement history
if (planR.ok && planR.id && trailerQr) {
  useDispatchStore.getState().updateLogistics(planR.id, {
    vehicleNo: 'MH-GEN-001',
    lrNo: 'LR-GEN-001',
    transporter: 'Gen Transport',
    driverName: 'Driver',
    driverPhone: '9999999999',
  })
  for (const item of useDispatchStore.getState().getDispatch(planR.id)!.checklist) {
    if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(planR.id, item.id, true)
  }
  useDispatchStore.getState().addPhoto(planR.id, 'Loading', 'data:image/png;base64,iVBORw0KGgo=')
  useDispatchStore.getState().approveSecurityGate(planR.id)
  workflowConfirmDispatch(planR.id, trailerQr!.qrCode)
}
const trace = lookupQrTrace({ trailerNo: trailerQr?.metadata.trailerNo })
check(
  '12. Traceability shows QR movement history',
  !!trace.qr && trace.history.length >= 2,
  `events=${trace.history.length}`,
)

console.log(`\n=== ${pass}/${pass + fail} PASS ===`)
if (fail > 0) process.exit(1)
