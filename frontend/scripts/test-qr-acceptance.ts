/**
 * QR acceptance checklist — 7 user-facing scenarios
 * npm run test:qr-acceptance
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
const { getGrnMaterialQrs } = await import('../src/utils/qrIntegration')
const {
  workflowPostGrn,
  workflowPostFgReceipt,
  workflowPostSaReceipt,
  workflowCreateDispatchPlan,
  workflowConfirmDispatch,
} = await import('../src/utils/qrWorkflow')
const { qrIssueToWo, resolveQrScan, buildTraceChain, traceChainHasTypes } = await import('../src/utils/qrEngine')
const { generateQrImageDataUrl } = await import('../src/utils/qrCode')

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
      referenceNo: 'ACCEPT-QR',
      remarks: 'acceptance test',
    })
  }
}

function fillBooleanParams(results: { parameterType: string; passFailRule?: string; minValue?: number | null; targetValue?: number | null }[]) {
  return results.map((r) =>
    r.parameterType === 'boolean'
      ? { ...r, actualValue: r.passFailRule === 'boolean_false' ? false : true }
      : r.parameterType === 'photo_required'
        ? { ...r, attachmentRef: 'photo.jpg', actualValue: 'photo.jpg' }
        : r.parameterType === 'numeric' && r.minValue != null
          ? { ...r, actualValue: r.targetValue ?? r.minValue }
          : r.parameterType === 'text'
            ? { ...r, actualValue: 'OK' }
            : r.parameterType === 'dropdown'
              ? { ...r, actualValue: 'Acceptable' }
              : r,
  )
}

async function prepareFgWithSaConsume(fgWoId: string) {
  const { qrSaConsume } = await import('../src/utils/qrEngine')
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
    store.startJobCard(jc.id, { assignedTeam: 'Acc', startTime: '08:00' })
    const fresh = store.getJobCards(fgWoId).find((j) => j.id === jc.id)!
    store.completeJobCard(jc.id, {
      endTime: '17:00',
      actualHours: 2,
      remarks: 'ok',
      qcChecks: fresh.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    const pending = qStore.getPendingInspections().find((i) => i.jobCardId === jc.id)
    if (pending?.parameterResults.length) {
      qStore.recordInspectionDecision(pending.id, {
        inspector: 'QC',
        result: 'pass',
        remarks: 'ok',
        parameterResults: fillBooleanParams(pending.parameterResults),
        useAutoDecision: true,
      })
    } else if (pending) {
      qStore.recordInspectionDecision(pending.id, { inspector: 'QC', result: 'pass', remarks: 'ok' })
    }
  }
  const complete = store.completeWorkOrder(fgWoId)
  if (!complete.ok) return { ok: false as const, error: complete.error }
  return workflowPostFgReceipt(fgWoId)
}

async function setupPoAndGrn() {
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
  const po = usePurchaseStore.getState().getPo(poId)!
  const poLine = po.lines[0]
  const grnR = workflowPostGrn(poId, [{ poLineId: poLine.id, receivedQty: poLine.qty }])
  const grn = usePurchaseStore.getState().grns[0]!
  return { so, grn, grnR, poLine }
}

console.log('=== QR Acceptance Checklist ===\n')
reset()

// 1. GRN Detail — accepted line shows QR generated
const { so, grn, grnR } = await setupPoAndGrn()
const grnQrs = getGrnMaterialQrs(grn.id)
const lineQr = grnQrs.find((r) => r.entityType === 'MATERIAL_LOT')
check('1. GRN accepted line shows QR generated', grnR.ok && !!lineQr && grnQrs.some((r) => r.entityId === grn.id || r.entityType === 'GRN_LINE'), lineQr?.displayCode)

// 2. QR print page — label data resolvable
const img = lineQr ? await generateQrImageDataUrl(lineQr.qrCode) : ''
check('2. QR print label renders', img.startsWith('data:image/png'), `/qr/print/${lineQr?.qrId}`)

// 3. Scan QR — entity preview resolves
const scan = lineQr ? resolveQrScan(lineQr.qrCode) : { ok: false as const, error: 'no qr' }
check('3. Scan QR opens entity preview', scan.ok && scan.record.entityType === 'MATERIAL_LOT', scan.ok ? scan.record.displayCode : scan.error)

// 4. Issue material by QR — stock ledger updates
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
ensureStock(lineQr!.metadata.itemId!, lineQr!.metadata.warehouseId!, 5)
const movesBefore = useInventoryStore.getState().stockMovements.length
const issue = qrIssueToWo({ scan: lineQr!.qrCode, woId: fgWo.woNo, qty: 1 })
const movesAfter = useInventoryStore.getState().stockMovements.length
check('4. Issue material by QR updates stock ledger', issue.ok && movesAfter > movesBefore, issue.message)

// 5. FG Receipt — trailer QR generates
const fgR = await prepareFgWithSaConsume(fgWo.id)
const trailerQr = useQrStore.getState().getForEntity('FINISHED_TRAILER', fgWo.id)[0]
check('5. FG Receipt generates trailer QR', fgR.ok && !!trailerQr, trailerQr?.displayCode)

// 6. Dispatch requires trailer QR scan
const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
const fqcInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'QC',
  result: 'pass',
  remarks: 'ok',
  parameterResults: fqcInsp?.parameterResults.length ? fillBooleanParams(fqcInsp.parameterResults) : undefined,
  useAutoDecision: true,
})
const candidate = useDispatchStore.getState().getReadyCandidates().find((c) => c.workOrderId === fgWo.id)
if (!candidate) {
  check('6a. Dispatch blocked without trailer QR scan', false, 'no candidate')
  check('6b. Dispatch succeeds after trailer QR scan', false)
  check('7. Traceability shows RM → SA → FG → Dispatch', false)
} else {
  const planR = workflowCreateDispatchPlan(candidate)
  useDispatchStore.getState().updateLogistics(planR.id!, { vehicleNo: 'MH-1', lrNo: 'LR-1', transporter: 'T', driverName: 'D', driverPhone: '9' })
  for (const item of useDispatchStore.getState().getDispatch(planR.id!)!.checklist) {
    if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(planR.id!, item.id, true)
  }
  useDispatchStore.getState().addPhoto(planR.id!, 'Load', 'data:image/png;base64,x')
  useDispatchStore.getState().approveSecurityGate(planR.id!)
  check('6a. Dispatch blocked without trailer QR scan', !workflowConfirmDispatch(planR.id!).ok)
  const dispatchOk = workflowConfirmDispatch(planR.id!, trailerQr!.qrCode)
  check('6b. Dispatch succeeds after trailer QR scan', dispatchOk.ok, dispatchOk.message ?? dispatchOk.error)

  const chain = buildTraceChain(trailerQr!.qrId)
  check(
    '7. Traceability shows RM → SA → FG → Dispatch',
    traceChainHasTypes(trailerQr!.qrId, ['MATERIAL_LOT', 'SUB_ASSEMBLY', 'FINISHED_TRAILER', 'DISPATCH']),
    chain.map((n) => `${n.entityType}:${n.displayCode}`).join(' | '),
  )
}

console.log(`\n=== ${pass}/${pass + fail} PASS ===`)
process.exit(fail > 0 ? 1 : 0)
