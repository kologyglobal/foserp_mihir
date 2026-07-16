/**
 * Dynamic WIP warehouse mapping — work center input / WIP / output (no seq hardcoding)
 * npx tsx scripts/test-wip-routing.ts
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
const { DEMO_WO_ANCHORS } = await import('../src/data/production/woAnchors')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useWorkCenterStore } = await import('../src/store/workCenterStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { buildEmptyParameterResults } = await import('../src/utils/qcPlanResolver')
import type { QcParameterResult } from '../src/types/qcParameters'
const { buildWipFlowStepsForWo, resolveWipFlowStep } = await import('../src/utils/wipFlow')
const { getWorkCenterWarehouseMapping } = await import('../src/utils/wipRouting')
const { validateJobCardWarehouseMapping } = await import('../src/utils/woWipActions')

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
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    activities: [],
  })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  useFreezeStore.setState({ freezes: [] })
}

function fillParams(results: QcParameterResult[], pass = true) {
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
              ? { ...r, actualValue: pass ? (r.dropdownOptions?.[0] ?? 'Acceptable') : 'Reject' }
              : r,
  )
}

function passInspection(inspectionId: string, inspector: string, remarks: string) {
  const qStore = useQualityStore.getState()
  const insp = qStore.getInspection(inspectionId)
  if (!insp) return { ok: false, error: 'Inspection not found' }
  const base = insp.parameterResults.length > 0 ? insp.parameterResults : buildEmptyParameterResults(insp.parameterSnapshot)
  return qStore.recordInspectionDecision(inspectionId, {
    inspector,
    result: 'pass',
    remarks,
    parameterResults: base.length > 0 ? fillParams(base, true) : undefined,
    useAutoDecision: base.length > 0,
  })
}

function ensureMaterials(woId: string) {
  for (const line of useWorkOrderStore.getState().getWoMaterials(woId)) {
    const free = useInventoryStore.getState().getFreeQty(line.itemId, line.warehouseId)
    if (free < line.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.requiredQty - free + 10,
        referenceNo: 'TEST-WIP-INW',
        remarks: 'Test inward for WIP routing',
      })
    }
  }
}

function completePriorOpsThrough(woId: string, maxSeq: number) {
  const woStore = useWorkOrderStore.getState()
  const qStore = useQualityStore.getState()
  const priorOps = woStore
    .getProductionOperations(woId)
    .filter((o) => o.sequenceNo < maxSeq && !o.outsourced)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)

  for (const op of priorOps) {
    const jc = woStore.getJobCards(woId).find((j) => j.productionOperationId === op.id)!
    woStore.startJobCard(jc.id, { assignedTeam: 'Setup Crew', startTime: '07:00' })
    woStore.completeJobCard(jc.id, {
      endTime: '11:00',
      actualHours: 3,
      remarks: 'Prior op complete (WIP test)',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qStore.getPendingInspections().find((i) => i.productionOperationId === op.id)
      if (insp) {
        passInspection(insp.id, 'Lata Menon', 'Auto-pass prior operation for WIP test')
      }
    }
  }
}

console.log('═══════════════════════════════════════')
console.log(' Dynamic WIP Warehouse Mapping (P2)')
console.log('═══════════════════════════════════════\n')

const wc = useWorkCenterStore.getState()
const master = useMasterStore.getState()
const workCenters = wc.workCenters

console.log('── Work center warehouse mapping ──')
const cutting = wc.getWorkCenterByCode('WC-CUTTING')!
const welding = wc.getWorkCenterByCode('WC-WELDING')!
const cuttingMap = getWorkCenterWarehouseMapping(cutting.id, workCenters)!
const weldingMap = getWorkCenterWarehouseMapping(welding.id, workCenters)!

check('Cutting input = RM_STORE', cuttingMap.inputWarehouseCode === 'RM_STORE')
check('Cutting wip = WIP_CUTTING', cuttingMap.wipWarehouseCode === 'WIP_CUTTING')
check('Cutting output = WIP_FABRICATION', cuttingMap.outputWarehouseCode === 'WIP_FABRICATION')
check('Welding input = WIP_FABRICATION', weldingMap.inputWarehouseCode === 'WIP_FABRICATION')
check('Welding wip = WIP_WELDING', weldingMap.wipWarehouseCode === 'WIP_WELDING')
check('Welding output = WIP_ASSEMBLY', weldingMap.outputWarehouseCode === 'WIP_ASSEMBLY')
check('WIP_FABRICATION warehouse exists', !!master.warehouses.find((w) => w.warehouseCode === 'WIP_FABRICATION'))
check('WIP_WELDING warehouse exists', !!master.warehouses.find((w) => w.warehouseCode === 'WIP_WELDING'))
check('WIP_ASSEMBLY warehouse exists', !!master.warehouses.find((w) => w.warehouseCode === 'WIP_ASSEMBLY'))

console.log('\n── Material issue → MOVE_TO_WIP (first op) ──')
reset()
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)
const tankWo = useWorkOrderStore.getState().workOrders.find((w) => w.woNo === DEMO_WO_ANCHORS.tankAssemblyWoNo)!
useWorkOrderStore.getState().planWorkOrder(tankWo.id)
useWorkOrderStore.getState().releaseWorkOrder(tankWo.id)
ensureMaterials(tankWo.id)
useWorkOrderStore.getState().reserveMaterials(tankWo.id)
useWorkOrderStore.getState().issueAllReserved(tankWo.id)

const wipCutting = master.warehouses.find((w) => w.warehouseCode === 'WIP_CUTTING')!
const line = useWorkOrderStore.getState().getWoMaterials(tankWo.id)[0]
const moveToWipIssue = useInventoryStore.getState().stockMovements.find(
  (m) => m.referenceType === 'MOVE_TO_WIP' && m.workOrderId === tankWo.id && m.warehouseId === wipCutting.id,
)
check('Material issue posts MOVE_TO_WIP to WIP_CUTTING', !!moveToWipIssue, line?.itemCode)

console.log('\n── Welding op WIP movement (work center mapping) ──')
useWorkOrderStore.getState().startProduction(tankWo.id)
completePriorOpsThrough(tankWo.id, DEMO_WO_ANCHORS.weldingSequenceNo)

const weldingJc = useWorkOrderStore.getState().getJobCards(tankWo.id).find((j) => j.sequenceNo === 40)!
const weldingOp = useWorkOrderStore.getState().getProductionOperations(tankWo.id).find((o) => o.sequenceNo === 40)!

const mappingGate = validateJobCardWarehouseMapping(
  weldingOp.workCenterId,
  weldingOp.workCenterCode,
  weldingOp.operationName,
  weldingOp.outsourced,
)
check('Welding op passes warehouse mapping validation', mappingGate.ok)

const movementsBeforeStart = useInventoryStore.getState().stockMovements.length
const startResult = useWorkOrderStore.getState().startJobCard(weldingJc.id, {
  assignedTeam: 'Welding Team A',
  startTime: '08:00',
})
check('Welding job card starts', startResult.ok, startResult.error)

const wipFab = master.warehouses.find((w) => w.warehouseCode === 'WIP_FABRICATION')!
const wipWelding = master.warehouses.find((w) => w.warehouseCode === 'WIP_WELDING')!
const wipAssembly = master.warehouses.find((w) => w.warehouseCode === 'WIP_ASSEMBLY')!
const moveToWipStart = useInventoryStore.getState().stockMovements.find(
  (m) =>
    m.referenceType === 'MOVE_TO_WIP' &&
    m.workOrderId === tankWo.id &&
    m.itemId === tankWo.outputItemId &&
    m.qty > 0 &&
    m.warehouseId === wipWelding.id,
)
check('Welding start MOVE_TO_WIP → WIP_WELDING', !!moveToWipStart, moveToWipStart?.movementNo)
check('WIP Movement activity on start', useWorkOrderStore.getState().activities.some((a) => a.action === 'WIP Movement' && a.details.includes('MOVE_TO_WIP')))

useWorkOrderStore.getState().completeJobCard(weldingJc.id, {
  endTime: '17:00',
  actualHours: 8,
  remarks: 'Tank welding complete',
  qcChecks: weldingJc.qcChecks.map((c) => ({ ...c, passed: true })),
})
const moveFromAssemblyBeforeQc = useInventoryStore.getState().stockMovements.filter(
  (m) =>
    m.referenceType === 'MOVE_FROM_WIP' &&
    m.workOrderId === tankWo.id &&
    m.warehouseId === wipAssembly.id,
)
check('No MOVE_FROM_WIP to WIP_ASSEMBLY before QC pass', moveFromAssemblyBeforeQc.length === 0)

const weldingInsp = useQualityStore.getState().getPendingInspections().find((i) => i.workOrderId === tankWo.id)!
passInspection(weldingInsp.id, 'Lata Menon', 'Welding QC pass — WIP release test')

const moveFromWip = useInventoryStore.getState().stockMovements.find(
  (m) =>
    m.referenceType === 'MOVE_FROM_WIP' &&
    m.workOrderId === tankWo.id &&
    m.itemId === tankWo.outputItemId &&
    m.qty > 0 &&
    m.warehouseId === wipAssembly.id,
)
check('Welding QC pass MOVE_FROM_WIP → WIP_ASSEMBLY', !!moveFromWip, moveFromWip?.movementNo)
check('Timeline logs WIP Movement on QC pass', useWorkOrderStore.getState().activities.some((a) => a.action === 'WIP Movement' && a.details.includes('MOVE_FROM_WIP')))

console.log('\n── Missing mapping blocks operation start ──')
const blockedWc = wc.getWorkCenter('wc-cutting')!
const cuttingOp = useWorkOrderStore.getState().getProductionOperations(tankWo.id).find((o) => o.sequenceNo === 10)
wc.updateWorkCenter(blockedWc.id, { inputWarehouseCode: null })
if (!cuttingOp) {
  check('Cutting operation available for mapping block test', false)
} else {
  const blockedGate = validateJobCardWarehouseMapping(
    cuttingOp.workCenterId,
    cuttingOp.workCenterCode,
    cuttingOp.operationName,
    cuttingOp.outsourced,
  )
  check('Op blocked when WC mapping missing', !blockedGate.ok, blockedGate.error)
}
wc.updateWorkCenter(blockedWc.id, {
  inputWarehouseCode: cuttingMap.inputWarehouseCode,
  wipWarehouseCode: cuttingMap.wipWarehouseCode,
  outputWarehouseCode: cuttingMap.outputWarehouseCode,
})

console.log('\n── Dynamic WIP flow panel ──')
const tankOps = useWorkOrderStore.getState().getProductionOperations(tankWo.id)
const steps = buildWipFlowStepsForWo(tankOps, workCenters)
check('Flow includes WIP_CUTTING', steps.some((s) => s.warehouseCode === 'WIP_CUTTING'))
check('Flow includes WIP_FABRICATION', steps.some((s) => s.warehouseCode === 'WIP_FABRICATION'))
check('Flow includes WIP_WELDING', steps.some((s) => s.warehouseCode === 'WIP_WELDING'))
check('Flow includes WIP_ASSEMBLY', steps.some((s) => s.warehouseCode === 'WIP_ASSEMBLY'))

const stepId = resolveWipFlowStep(
  tankWo,
  useWorkOrderStore.getState().getWoMaterials(tankWo.id),
  useWorkOrderStore.getState().getProductionOperations(tankWo.id),
  workCenters,
)
check('Tank WO current step after welding PASS', stepId.includes('wip') || stepId.includes('assembly'), stepId)

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exitCode = 1
