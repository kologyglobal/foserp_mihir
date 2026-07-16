/**
 * Quality Decision Engine — anchored on WO-0001 · SA-TANK-ASM · Welding (seq 40)
 * npx tsx scripts/test-quality-flow.ts
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
const { useQualityStore } = await import('../src/store/qualityStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { buildEmptyParameterResults } = await import('../src/utils/qcPlanResolver')
import type { QcParameterResult } from '../src/types/qcParameters'
const { canStartOperation } = await import('../src/utils/qualityEngine')

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
    saReceipts: [],
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

function passInspection(inspectionId: string, inspector: string, remarks: string, result: 'pass' | 'rework' | 'reject' = 'pass') {
  const qStore = useQualityStore.getState()
  const insp = qStore.getInspection(inspectionId)
  if (!insp) return { ok: false, error: 'Inspection not found' }
  const base = insp.parameterResults.length > 0 ? insp.parameterResults : buildEmptyParameterResults(insp.parameterSnapshot)
  const params = base.length > 0 ? fillParams(base, result !== 'reject') : undefined
  return qStore.recordInspectionDecision(inspectionId, {
    inspector,
    result,
    remarks,
    parameterResults: params,
    useAutoDecision: result === 'pass' && (params?.length ?? 0) > 0,
    reworkEstimatedHours: result === 'rework' ? 3 : undefined,
  })
}

function ensureTankWoMaterials(tankWoId: string) {
  const lines = useWorkOrderStore.getState().getWoMaterials(tankWoId)
  for (const line of lines) {
    const free = useInventoryStore.getState().getFreeQty(line.itemId, line.warehouseId)
    if (free < line.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.requiredQty - free + 10,
        referenceNo: 'TEST-TANK-INW',
        remarks: 'Test inward for tank WO quality flow',
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
      remarks: 'Prior op complete (test)',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qStore.getPendingInspections().find((i) => i.productionOperationId === op.id)
      if (insp) {
        passInspection(insp.id, 'Lata Menon', 'Auto-pass prior operation for quality test')
      }
    }
  }
}

function setupTankWoWeldingQcHold() {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === DEMO_WO_ANCHORS.salesOrderNo)!
  const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
  useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)

  const tankWo =
    useWorkOrderStore.getState().workOrders.find((w) => w.woNo === DEMO_WO_ANCHORS.tankAssemblyWoNo) ??
    useWorkOrderStore.getState().workOrders.find((w) => w.outputItemCode === DEMO_WO_ANCHORS.tankOutputItemCode)!

  useWorkOrderStore.getState().planWorkOrder(tankWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(tankWo.id)
  ensureTankWoMaterials(tankWo.id)
  useWorkOrderStore.getState().reserveMaterials(tankWo.id)
  const issueResult = useWorkOrderStore.getState().issueAllReserved(tankWo.id)
  if (!issueResult.ok) {
    throw new Error(`Tank WO issue failed: ${issueResult.error ?? 'unknown'}`)
  }
  const startResult = useWorkOrderStore.getState().startProduction(tankWo.id)
  if (!startResult.ok) {
    throw new Error(`Tank WO start production failed: ${startResult.error ?? 'unknown'}`)
  }

  completePriorOpsThrough(tankWo.id, DEMO_WO_ANCHORS.weldingSequenceNo)

  const weldingJc = useWorkOrderStore
    .getState()
    .getJobCards(tankWo.id)
    .find((j) => j.sequenceNo === DEMO_WO_ANCHORS.weldingSequenceNo)
  if (!weldingJc) {
    throw new Error(`Welding job card (seq ${DEMO_WO_ANCHORS.weldingSequenceNo}) not found on ${tankWo.woNo}`)
  }
  useWorkOrderStore.getState().startJobCard(weldingJc.id, { assignedTeam: 'Welding Team A', startTime: '08:00' })
  useWorkOrderStore.getState().completeJobCard(weldingJc.id, {
    endTime: '17:00',
    actualHours: 8,
    remarks: 'Tank shell welding complete',
    qcChecks: weldingJc.qcChecks.map((c) => ({ ...c, passed: true })),
  })

  return { tankWo, weldingJc }
}

console.log('═══════════════════════════════════════')
console.log(' Quality Test — WO-0001 Tank Welding')
console.log('═══════════════════════════════════════\n')

reset()
const { tankWo } = setupTankWoWeldingQcHold()

check('WO-0001 is Tank Assembly sub-WO', tankWo.woNo === DEMO_WO_ANCHORS.tankAssemblyWoNo)
check('Tank WO output is SA-TANK-ASM', tankWo.outputItemCode === DEMO_WO_ANCHORS.tankOutputItemCode)

console.log('\n── PASS workflow (WO-0001 · Welding) ──')
const insp = useQualityStore.getState().getPendingInspections().find((i) => i.workOrderId === tankWo.id)
check('Pending inspection created', !!insp, insp?.inspectionNo)
check('Inspection type is welding', insp?.inspectionType.includes('Welding') ?? false)

const woBlocked = useWorkOrderStore.getState().completeWorkOrder(tankWo.id)
check('WO blocked on open QC hold', !woBlocked.ok)

const passResult = passInspection(insp!.id, 'Lata Menon', 'All weld checks passed', 'pass')
check('PASS decision succeeds', passResult.ok)
check('Welding op completed', useWorkOrderStore.getState().getProductionOperations(tankWo.id).find((o) => o.sequenceNo === 40)?.status === 'completed')

console.log('\n── REWORK → Reinspect → PASS → Next Op (WO-0001) ──')
reset()
const { tankWo: tankWo2 } = setupTankWoWeldingQcHold()
check('Anchor WO-0001 tank sub-assembly', tankWo2.woNo === 'WO-0001' && tankWo2.outputItemCode === 'SA-TANK-ASM')

const insp2 = useQualityStore.getState().getPendingInspections().find((i) => i.workOrderId === tankWo2.id)!
const reworkDecision = passInspection(
  insp2.id,
  'Pradeep Singh',
  'Porosity in tank longitudinal seam — grind and re-weld',
  'rework',
)
check('QC REWORK creates rework order', reworkDecision.ok && !!reworkDecision.reworkId)

const rework = useQualityStore.getState().getRework(reworkDecision.reworkId!)
check('Rework order is open', rework?.status === 'open')
check('WO blocked with open rework', !useWorkOrderStore.getState().completeWorkOrder(tankWo2.id).ok)

useQualityStore.getState().startRework(rework!.id, { assignedTeam: 'Welding Team B' })
check('Rework in progress', useQualityStore.getState().getRework(rework!.id)?.status === 'in_progress')

const reworkDone = useQualityStore.getState().completeRework(rework!.id, { actualHours: 2.5, remarks: 'Seam re-welded' })
check('Rework complete → re-inspection queued', reworkDone.ok)
check('Re-inspection pending', useQualityStore.getState().getPendingInspections().some((i) => i.isReinspection))
check('Welding on QC hold for re-inspection', useWorkOrderStore.getState().getProductionOperations(tankWo2.id).find((o) => o.sequenceNo === 40)?.status === 'qc_hold')

const nextJc = useWorkOrderStore.getState().getJobCards(tankWo2.id).find((j) => j.sequenceNo === DEMO_WO_ANCHORS.nextOperationAfterWeldingSeq)!
check('Next op is Chassis Assembly (seq 50)', nextJc.operationName === DEMO_WO_ANCHORS.nextOperationAfterWeldingName)
check('Next operation blocked before re-inspection PASS', !useWorkOrderStore.getState().startJobCard(nextJc.id, { assignedTeam: 'Chassis Crew', startTime: '08:00' }).ok)

const reinspection = useQualityStore.getState().getPendingInspections().find((i) => i.isReinspection)!
passInspection(reinspection.id, 'Lata Menon', 'Tank weld re-inspection passed after rework', 'pass')
check('Re-inspection PASS closes rework', useQualityStore.getState().getRework(rework!.id)?.status === 'closed')
check('Welding released after re-inspection PASS', useWorkOrderStore.getState().getProductionOperations(tankWo2.id).find((o) => o.sequenceNo === 40)?.status === 'completed')
check('Next operation released activity logged', useWorkOrderStore.getState().activities.some((a) => a.action === 'Next Operation Released' && a.workOrderId === tankWo2.id))

const ops = useWorkOrderStore.getState().getProductionOperations(tankWo2.id)
check(`${DEMO_WO_ANCHORS.nextOperationAfterWeldingName} can start`, canStartOperation(ops, nextJc.productionOperationId).ok)
check('Next operation job card starts', useWorkOrderStore.getState().startJobCard(nextJc.id, { assignedTeam: 'Chassis Crew', startTime: '08:00' }).ok)

console.log('\n── REJECT / NCR workflow (WO-0001) ──')
reset()
const { tankWo: tankWo3 } = setupTankWoWeldingQcHold()
const insp3 = useQualityStore.getState().getPendingInspections().find((i) => i.workOrderId === tankWo3.id)!

const failParams = fillParams(
  insp3.parameterResults.length > 0 ? insp3.parameterResults : buildEmptyParameterResults(insp3.parameterSnapshot),
  true,
).map((r) => (r.parameterCode === 'WELD-POROSITY' ? { ...r, actualValue: false } : r))

const rejectResult = useQualityStore.getState().recordInspectionDecision(insp3.id, {
  inspector: 'Meera Joshi',
  result: 'reject',
  remarks: 'Critical tank leak test failure',
  parameterResults: failParams,
  useAutoDecision: true,
  ncrSeverity: 'critical',
  ncrDefectDescription: 'Tank shell leak at weld toe — hydrostatic fail',
  materialSegregated: true,
})
check('REJECT creates NCR', rejectResult.ok && !!rejectResult.ncrId)
const ncr = useQualityStore.getState().getNcr(rejectResult.ncrId!)
check('NCR linked to WO-0001', ncr?.woNo === 'WO-0001')
check('WO blocked with open NCR', !useWorkOrderStore.getState().completeWorkOrder(tankWo3.id).ok)

useQualityStore.getState().updateNcr(ncr!.id, {
  rootCause: 'Insufficient preheat on CHS joint',
  correctiveAction: 'Re-weld per WPS-042 with preheat 120°C',
})
useQualityStore.getState().advanceNcrStatus(ncr!.id, 'investigating')
useQualityStore.getState().advanceNcrStatus(ncr!.id, 'corrective_action')
useQualityStore.getState().advanceNcrStatus(ncr!.id, 'approved')
const { setSessionUserForTests } = await import('../src/utils/permissions')
check('Critical NCR close blocked pending approval', !useQualityStore.getState().closeNcr(ncr!.id).ok)
setSessionUserForTests({ role: 'quality_head', name: 'Quality Head' })
check('Critical NCR closure approved via matrix', useQualityStore.getState().approveNcrClosure(ncr!.id).ok)
check('NCR closed after investigation', useQualityStore.getState().closeNcr(ncr!.id).ok)

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exitCode = 1
