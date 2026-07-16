/**
 * Dispatch module — plan, logistics, checklist, photos, customer ack
 * npx tsx scripts/test-dispatch.ts
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
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useFreezeStore } = await import('../src/store/freezeStore')

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
  useMrpStore.setState({ runs: [], salesOrders: seedSalesOrders.map((s) => ({ ...s })) })
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
  useFreezeStore.setState({ freezes: [] })
}

function markFgReadyForDispatch(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  const fgWo = store.getWorkOrder(fgWoId)!
  const master = useMasterStore.getState()
  const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
  useInventoryStore.getState().postFgReceipt({
    itemId: fgWo.fgItemId,
    warehouseId: fgWh.id,
    qty: fgWo.qty,
    referenceNo: fgWo.woNo,
    remarks: 'Dispatch test FG',
    workOrderId: fgWo.id,
  })
  useWorkOrderStore.setState((s) => ({
    workOrders: s.workOrders.map((w) => (w.id === fgWoId ? { ...w, status: 'fg_received' as const } : w)),
  }))
  return { ok: true }
}

function ensureLineStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'TEST-DSP-INW',
      remarks: 'Test inward for dispatch flow',
    })
  }
}

function prepareFgForDispatch(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  const master = useMasterStore.getState()

  for (const child of store.workOrders.filter(
    (w) => w.parentWoId === fgWoId && w.woType === 'manufactured_sub_assembly',
  )) {
    store.planWorkOrder(child.id)
    store.releaseWorkOrder(child.id)
    for (const line of store.getWoMaterials(child.id)) {
      ensureLineStock(line.itemId, line.warehouseId, line.requiredQty)
    }
    store.reserveMaterials(child.id)
    store.issueAllReserved(child.id)
    store.completeWorkOrder(child.id)
    store.postSaReceipt(child.id)
  }

  const paintLine = store.getWoMaterials(fgWoId).find((l) => l.itemCode === 'SA-PAINT-SYS')
  if (paintLine) {
    ensureLineStock(paintLine.itemId, paintLine.warehouseId, paintLine.requiredQty)
  }

  for (const line of store.getWoMaterials(fgWoId)) {
    ensureLineStock(line.itemId, line.warehouseId, line.requiredQty)
  }
  store.planWorkOrder(fgWoId)
  store.releaseWorkOrder(fgWoId)
  store.reserveMaterials(fgWoId)
  store.issueAllReserved(fgWoId)
  store.startProduction(fgWoId)

  const qStore = useQualityStore.getState()
  for (const jc of store.getJobCards(fgWoId)) {
    store.startJobCard(jc.id, { assignedTeam: 'Dispatch Test Crew', startTime: '08:00' })
    const fresh = store.getJobCards(fgWoId).find((j) => j.id === jc.id)!
    store.completeJobCard(jc.id, {
      endTime: '17:00',
      actualHours: 2,
      remarks: 'Dispatch test completion',
      qcChecks: fresh.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    const pending = qStore.getPendingInspections().find((i) => i.jobCardId === jc.id)
    if (pending) {
      qStore.recordInspectionDecision(pending.id, {
        inspector: 'Pradeep Singh',
        result: 'pass',
        remarks: 'Auto-pass for dispatch test',
      })
    }
  }

  store.completeWorkOrder(fgWoId)
  return store.postFgReceipt(fgWoId)
}

console.log('=== Dispatch Module ===\n')
reset()

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)

const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
const master = useMasterStore.getState()
const fgYard = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!

const fgReceipt = markFgReadyForDispatch(fgWo.id)
check('FG receipt posts', fgReceipt.ok, fgReceipt.error)

const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
check('Final QC created', fqc.ok, fqc.error)
const fqcInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
const fqcParams = fqcInsp?.parameterResults.map((r) =>
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
useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'Pradeep Singh',
  result: 'pass',
  remarks: 'Final QC pass for dispatch test',
  parameterResults: fqcParams,
  useAutoDecision: true,
})

const onHandBeforeDispatch = useInventoryStore.getState().getOnHand(fgWo.fgItemId, fgYard!.id)

const candidates = useDispatchStore.getState().getReadyCandidates()
check('Dispatch candidate for FG WO', candidates.some((c) => c.workOrderId === fgWo.id), `count=${candidates.length}`)

const candidate = candidates.find((c) => c.workOrderId === fgWo.id)
if (!candidate) {
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(1)
}
const create = useDispatchStore.getState().createDispatchPlan(candidate)
check('Create dispatch plan', create.ok, create.error)
const plan = useDispatchStore.getState().getDispatch(create.id!)!
check('Plan has checklist', plan.checklist.length >= 6)
check('Plan has per-unit dispatch lines', plan.lines.length >= 1, `units=${plan.lines.length}`)
check('Trailer numbers assigned', plan.lines.every((l) => l.trailerNo && l.chassisNo))

useDispatchStore.getState().updateLogistics(plan.id, {
  vehicleNo: 'MH-12-AB-9999',
  lrNo: 'LR-TEST-001',
  transporter: 'Test Transport Co',
  driverName: 'Ramesh Patil',
  driverPhone: '9876543210',
})

for (const item of useDispatchStore.getState().getDispatch(plan.id)!.checklist) {
  if (!item.systemGate) {
    useDispatchStore.getState().toggleChecklistItem(plan.id, item.id, true)
  }
}

useDispatchStore.getState().addPhoto(plan.id, 'Loading', 'data:image/png;base64,iVBORw0KGgo=')

check('Security gate approval', useDispatchStore.getState().approveSecurityGate(plan.id).ok)

const confirmed = useDispatchStore.getState().confirmDispatch(plan.id)
check('Confirm dispatch succeeds', confirmed.ok, confirmed.error)

const onHandAfter = useInventoryStore.getState().getOnHand(fgWo.fgItemId, fgYard!.id)
check('FG stock reduced', onHandAfter < onHandBeforeDispatch, `${onHandBeforeDispatch} → ${onHandAfter}`)

const movement = useInventoryStore.getState().stockMovements.find((m) => m.referenceType === 'FG_DISPATCH')
check('FG_DISPATCH movement posted', !!movement, movement?.movementNo)

const soAfter = useMrpStore.getState().getSalesOrder(so.id)!
check('SO status dispatched', soAfter.status === 'dispatched')

useDispatchStore.getState().markInTransit(plan.id)
check('Mark in transit', useDispatchStore.getState().getDispatch(plan.id)!.status === 'in_transit')

const ack = useDispatchStore.getState().recordCustomerAck(plan.id, {
  acknowledgedBy: 'Suresh Mehta',
  designation: 'Plant Manager',
  ackDate: new Date().toISOString().slice(0, 10),
  remarks: 'Received in good condition',
  signatureDataUrl: null,
  photoDataUrl: null,
})
check('Customer acknowledgement', ack.ok)
check('Status pod_received', useDispatchStore.getState().getDispatch(plan.id)!.status === 'pod_received')
check('Close dispatch', useDispatchStore.getState().closeDispatch(plan.id).ok)
check('Status closed', useDispatchStore.getState().getDispatch(plan.id)!.status === 'closed')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
