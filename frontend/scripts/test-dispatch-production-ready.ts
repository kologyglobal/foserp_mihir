/**
 * Dispatch production readiness tests
 * npx tsx scripts/test-dispatch-production-ready.ts
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

const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useMasterStore } = await import('../src/store/masterStore')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
useDispatchStore.setState({ dispatches: [] })
useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
useWorkOrderStore.setState({ workOrders: [], materialLines: [], productionOperations: [], jobCards: [], subcontractShipments: [], fgReceipts: [], saReceipts: [], activities: [] })
useMrpStore.setState({ runs: [] })

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!

const master = useMasterStore.getState()
const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
useInventoryStore.getState().postFgReceipt({
  itemId: fgWo.fgItemId,
  warehouseId: fgWh.id,
  qty: fgWo.qty,
  referenceNo: fgWo.woNo,
  remarks: 'Test FG',
  workOrderId: fgWo.id,
})
useWorkOrderStore.setState((s) => ({
  workOrders: s.workOrders.map((w) => (w.id === fgWo.id ? { ...w, status: 'fg_received' as const } : w)),
}))

check('No dispatch without final QC', useDispatchStore.getState().getReadyCandidates().length === 0)

const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
const finalInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
const finalParams = finalInsp?.parameterResults.map((r) =>
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
  inspector: 'QC',
  result: 'pass',
  remarks: 'OK',
  parameterResults: finalParams,
  useAutoDecision: true,
})
const candidates = useDispatchStore.getState().getReadyCandidates()
check('Candidates after final QC', candidates.some((c) => c.workOrderId === fgWo.id))

const cand = candidates.find((c) => c.workOrderId === fgWo.id)!
const plan = useDispatchStore.getState().createDispatchPlan(cand)
check('Dispatch plan created', plan.ok, plan.id)

const dispatchId = plan.id!
useDispatchStore.getState().updateLogistics(dispatchId, {
  vehicleNo: 'MH-12-XX-0001',
  lrNo: 'LR-001',
  transporter: 'Test Transport',
  driverName: 'Driver',
  driverPhone: '9999999999',
})
for (const item of useDispatchStore.getState().getDispatch(dispatchId)!.checklist) {
  if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(dispatchId, item.id, true)
}
useDispatchStore.getState().addPhoto(dispatchId, 'Load photo', 'data:image/png;base64,abc')
check('Dispatch blocked without gate pass', !useDispatchStore.getState().confirmDispatch(dispatchId).ok)

check('Security gate approval', useDispatchStore.getState().approveSecurityGate(dispatchId).ok)
const confirm = useDispatchStore.getState().confirmDispatch(dispatchId)
check('Dispatch confirms with FG issue', confirm.ok, confirm.movementNo)

const movement = useInventoryStore.getState().stockMovements.find((m) => m.referenceType === 'FG_DISPATCH')
check('FG_DISPATCH movement posted', !!movement)

useDispatchStore.getState().recordCustomerAck(dispatchId, {
  acknowledgedBy: 'Customer',
  designation: 'Store',
  ackDate: new Date().toISOString().slice(0, 10),
  remarks: 'Received',
  signatureDataUrl: null,
  photoDataUrl: null,
})
check('POD sets pod_received', useDispatchStore.getState().getDispatch(dispatchId)!.status === 'pod_received')
check('Close dispatch', useDispatchStore.getState().closeDispatch(dispatchId).ok)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
