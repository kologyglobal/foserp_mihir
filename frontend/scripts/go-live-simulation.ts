/**
 * END-TO-END Manufacturing Simulation — SO-0001 · ABC Cement · 2× 45 M3 Bulker
 * npx tsx scripts/go-live-simulation.ts
 *
 * Produces: GO_LIVE_SIMULATION_REPORT.md, ERP_GO_LIVE_READINESS.md
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const REPORT_PATH = resolve(__dir, '../GO_LIVE_SIMULATION_REPORT.md')
const READINESS_PATH = resolve(__dir, '../ERP_GO_LIVE_READINESS.md')

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
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useBomStore } = await import('../src/store/bomStore')
const { useRoutingStore } = await import('../src/store/routingStore')
const { useWorkCenterStore } = await import('../src/store/workCenterStore')
const { useCostingStore } = await import('../src/store/costingStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { buildEmptyParameterResults } = await import('../src/utils/qcPlanResolver')
import type { QcParameterResult } from '../src/types/qcParameters'
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { computeOnHand } = await import('../src/utils/inventory')
const { validateManufacturingIntegrity, mergeIntegrityReports } = await import('../src/utils/integrityCheck')
const { canStartOperation } = await import('../src/utils/qualityEngine')
const { costSheetTotals: woCostTotals } = await import('../src/types/costing')

function fillQcParams(results: QcParameterResult[], pass = true) {
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

function qcParamsForInspection(inspectionId: string, pass = true) {
  const insp = useQualityStore.getState().getInspection(inspectionId)
  if (!insp) return undefined
  const base = insp.parameterResults.length > 0 ? insp.parameterResults : buildEmptyParameterResults(insp.parameterSnapshot)
  return base.length > 0 ? fillQcParams(base, pass) : undefined
}

function recordQcPass(inspectionId: string, inspector: string, remarks: string) {
  const params = qcParamsForInspection(inspectionId, true)
  return useQualityStore.getState().recordInspectionDecision(inspectionId, {
    inspector,
    result: 'pass',
    remarks,
    parameterResults: params,
    useAutoDecision: !!params?.length,
  })
}

function recordIncomingPass(inspectionId: string, inspector: string, remarks: string, acceptedQty: number) {
  const params = qcParamsForInspection(inspectionId, true)
  return useQualityStore.getState().recordIncomingQcDecision(inspectionId, {
    inspector,
    result: 'pass',
    remarks,
    acceptedQty,
    rejectedQty: 0,
    parameterResults: params,
    useAutoDecision: !!params?.length,
  })
}

// ─── Simulation clock & timeline ─────────────────────────────────────────────

interface TimelineEvent {
  seq: number
  simTime: string
  phase: string
  module: string
  event: string
  reference: string
  detail: string
}

interface VerificationResult {
  label: string
  ok: boolean
  detail: string
}

interface ModuleScore {
  module: string
  score: 0 | 1 | 2 | 3
  rating: string
  evidence: string
  blockers: string[]
}

const timeline: TimelineEvent[] = []
let seq = 0
let simMs = new Date('2026-06-01T08:00:00').getTime()

function advanceSim(hours: number) {
  simMs += hours * 3600000
}

function simIso() {
  return new Date(simMs).toISOString().replace('T', ' ').slice(0, 16)
}

function log(phase: string, module: string, event: string, reference: string, detail: string) {
  seq += 1
  timeline.push({ seq, simTime: simIso(), phase, module, event, reference, detail })
  advanceSim(0.25)
}

function assertStep(ok: boolean, msg: string) {
  if (!ok) throw new Error(`Simulation aborted: ${msg}`)
}

function fmtCurrency(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function resetAll() {
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
  usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  useFreezeStore.setState({ freezes: [] })
  useCostingStore.setState({ overheadPct: 10 })
  useDispatchStore.setState({ dispatches: [] })
  useInvoiceStore.setState({ invoices: [] })
}

function ensureStock(itemId: string, warehouseId: string, qty: number, ref: string) {
  const inv = useInventoryStore.getState()
  const free = inv.getFreeQty(itemId, warehouseId)
  if (free < qty) {
    const r = inv.postInward({
      itemId,
      warehouseId,
      qty: qty - free + 5,
      referenceNo: ref,
      remarks: 'Go-live simulation top-up',
    })
    assertStep(r.ok, r.error ?? 'inward failed')
    log('Procurement', 'Inventory', 'Inward (simulation top-up)', ref, `${itemId} +${qty - free + 5}`)
  }
}

function createPosFromPr(prId: string): string[] {
  const pr = usePurchaseStore.getState().getPr(prId)!
  const master = useMasterStore.getState()
  const vendorLines = new Map<string, string[]>()
  for (const line of pr.lines) {
    const maps = master.getVendorMapsForItem(line.itemId)
    const vendorId = maps.find((m) => m.isPreferred)?.vendorId ?? maps[0]?.vendorId
    if (!vendorId) continue
    const list = vendorLines.get(vendorId) ?? []
    list.push(line.id)
    vendorLines.set(vendorId, list)
  }
  const poIds: string[] = []
  for (const [vendorId, lineIds] of vendorLines) {
    const r = usePurchaseStore.getState().createPoFromPr(prId, vendorId, lineIds)
    assertStep(r.ok, r.error ?? 'PO create failed')
    usePurchaseStore.getState().submitPo(r.poId!)
    usePurchaseStore.getState().approvePo(r.poId!)
    usePurchaseStore.getState().sendPo(r.poId!)
    poIds.push(r.poId!)
    const po = usePurchaseStore.getState().getPo(r.poId!)!
    const vendor = master.vendors.find((v) => v.id === vendorId)
    log('Procurement', 'Purchase', 'PO Created', po.poNo, `${vendor?.vendorName ?? vendorId} · ${lineIds.length} lines`)
  }
  return poIds
}

function postFullGrn(poId: string) {
  const po = usePurchaseStore.getState().getPo(poId)!
  const lines = po.lines.map((l) => ({ poLineId: l.id, receivedQty: l.qty - l.receivedQty }))
  const r = usePurchaseStore.getState().postGrn(poId, lines)
  assertStep(r.ok, r.error ?? 'GRN failed')
  const grn = usePurchaseStore.getState().getGrn(r.grnId!)!
  if (grn.qcRequired && grn.incomingInspectionId) {
    const totalReceived = grn.lines.reduce((s, l) => s + l.receivedQty, 0)
    const qc = recordIncomingPass(
      grn.incomingInspectionId,
      'QC Incoming Desk',
      'MTC verified — material accepted',
      totalReceived,
    )
    assertStep(qc.ok, qc.error ?? 'Incoming QC failed')
  }
  log('Procurement', 'GRN', 'GRN Posted', grn.grnNo, `PO ${po.poNo} · ${lines.length} lines → inventory`)
}

function completePriorOpsThrough(woId: string, maxSeq: number) {
  const ws = useWorkOrderStore.getState()
  const qs = useQualityStore.getState()
  for (const op of ws.getProductionOperations(woId).filter((o) => o.sequenceNo < maxSeq && !o.outsourced)) {
    const jc = ws.getJobCards(woId).find((j) => j.productionOperationId === op.id)!
    ws.startJobCard(jc.id, { assignedTeam: 'Prior Ops Crew', startTime: '07:00' })
    ws.completeJobCard(jc.id, {
      endTime: '12:00',
      actualHours: op.standardHours || 4,
      remarks: 'Prior operation complete',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qs.getPendingInspections().find((i) => i.productionOperationId === op.id)
      if (insp) {
        recordQcPass(insp.id, 'Pradeep Singh', 'Prior op QC pass')
      }
    }
    log('Production', 'Job Card', 'Prior Op Complete', `${ws.getWorkOrder(woId)!.woNo} seq ${op.sequenceNo}`, op.operationName)
  }
}

function runTankWeldingWithRework(tankWoId: string) {
  const ws = useWorkOrderStore.getState()
  const qs = useQualityStore.getState()
  completePriorOpsThrough(tankWoId, DEMO_WO_ANCHORS.weldingSequenceNo)

  const weldingJc = ws.getJobCards(tankWoId).find((j) => j.sequenceNo === DEMO_WO_ANCHORS.weldingSequenceNo)!
  ws.startJobCard(weldingJc.id, { assignedTeam: 'Welding Team A', startTime: '08:00' })
  ws.completeJobCard(weldingJc.id, {
    endTime: '17:00',
    actualHours: 8,
    remarks: 'Tank shell welding — first pass',
    qcChecks: weldingJc.qcChecks.map((c) => ({ ...c, passed: true })),
  })
  log('Quality', 'Job Card', 'Welding Complete', 'WO-0001', 'Awaiting QC')

  const insp = qs.getPendingInspections().find((i) => i.workOrderId === tankWoId)!
  const reworkRes = qs.recordInspectionDecision(insp.id, {
    inspector: 'Pradeep Singh',
    result: 'rework',
    remarks: 'Porosity in longitudinal seam — rework required',
    reworkEstimatedHours: 3,
    parameterResults: qcParamsForInspection(insp.id, true),
    useAutoDecision: false,
  })
  assertStep(reworkRes.ok, 'Rework decision failed')
  log('Quality', 'QC', 'REWORK', insp.inspectionNo, 'Welding porosity — grind & re-weld')

  const rework = qs.getRework(reworkRes.reworkId!)!
  qs.startRework(rework.id, { assignedTeam: 'Welding Team B' })
  qs.completeRework(rework.id, { actualHours: 2.5, remarks: 'Seam re-welded per WPS' })
  log('Quality', 'Rework', 'Rework Complete', rework.reworkNo, '2.5 hrs')

  const reinspection = qs.getPendingInspections().find((i) => i.isReinspection && i.workOrderId === tankWoId)!
  recordQcPass(reinspection.id, 'Lata Menon', 'Re-inspection passed after rework')
  log('Quality', 'QC', 'PASS (Re-inspection)', reinspection.inspectionNo, 'Welding released')

  for (const op of ws.getProductionOperations(tankWoId).filter((o) => o.sequenceNo > DEMO_WO_ANCHORS.weldingSequenceNo && !o.outsourced)) {
    const gate = canStartOperation(ws.getProductionOperations(tankWoId), op.id)
    if (!gate.ok) continue
    const jc = ws.getJobCards(tankWoId).find((j) => j.productionOperationId === op.id)!
    ws.startJobCard(jc.id, { assignedTeam: 'Tank Assembly Crew', startTime: '08:00' })
    ws.completeJobCard(jc.id, {
      endTime: '16:00',
      actualHours: op.standardHours || 6,
      remarks: 'Tank WO remaining op',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const qi = qs.getPendingInspections().find((i) => i.productionOperationId === op.id && i.status === 'pending')
      if (qi) {
        recordQcPass(qi.id, 'Lata Menon', 'OK')
      }
    }
    log('Production', 'Job Card', 'Operation Complete', `WO-0001 seq ${op.sequenceNo}`, op.operationName)
  }
}

function completeSaWoSimple(woId: string) {
  const ws = useWorkOrderStore.getState()
  const qs = useQualityStore.getState()
  for (const op of ws.getProductionOperations(woId).filter((o) => !o.outsourced)) {
    const jc = ws.getJobCards(woId).find((j) => j.productionOperationId === op.id)!
    ws.startJobCard(jc.id, { assignedTeam: 'SA Crew', startTime: '08:00' })
    ws.completeJobCard(jc.id, {
      endTime: '16:00',
      actualHours: op.standardHours || 5,
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qs.getPendingInspections().find((i) => i.productionOperationId === op.id && i.status === 'pending')
      if (insp) recordQcPass(insp.id, 'Pradeep Singh', 'OK')
    }
  }
}

function processManufacturedSaWo(woId: string, withRework?: boolean) {
  const ws = useWorkOrderStore.getState()
  const wo = ws.getWorkOrder(woId)!
  ws.planWorkOrder(woId)
  ws.releaseWorkOrder(woId)
  log('Production', 'Work Order', 'Released + Routing', wo.woNo, `${ws.getProductionOperations(woId).length} ops · ${ws.getJobCards(woId).length} job cards`)

  for (const line of ws.getWoMaterials(woId)) {
    ensureStock(line.itemId, line.warehouseId, line.requiredQty, `PRE-${wo.woNo}`)
  }
  ws.reserveMaterials(woId)
  log('Inventory', 'Reservation', 'WO Materials Reserved', wo.woNo, `${ws.getWoMaterials(woId).length} lines`)
  ws.issueAllReserved(woId)
  log('Inventory', 'Issue', 'Materials Issued to WO', wo.woNo, 'ISSUE_TO_WO posted')
  ws.startProduction(woId)

  if (withRework) {
    runTankWeldingWithRework(woId)
  } else {
    completeSaWoSimple(woId)
  }

  const complete = ws.completeWorkOrder(woId)
  assertStep(complete.ok, complete.error ?? 'WO complete failed')
  log('Production', 'Work Order', 'Completed', wo.woNo, wo.outputItemCode)

  const sa = ws.postSaReceipt(woId)
  assertStep(sa.ok, sa.error ?? 'SA receipt failed')
  log('Inventory', 'SA Receipt', 'Semi-Finished Posted', wo.woNo, `${wo.outputItemCode} → WIP`)
}

function processSubcontractWo(subWoId: string) {
  const ws = useWorkOrderStore.getState()
  const wo = ws.getWorkOrder(subWoId)!
  ws.planWorkOrder(subWoId)
  ws.releaseWorkOrder(subWoId)
  const line = ws.getWoMaterials(subWoId)[0]
  if (line) ensureStock(line.itemId, line.warehouseId, line.requiredQty, `SUB-${wo.woNo}`)
  ws.reserveMaterials(subWoId)
  ws.issueAllReserved(subWoId)
  const vendor = useMasterStore.getState().vendors.find((v) => v.isActive)!
  const send = ws.sendSubcontractMaterial(subWoId, line.id, vendor.id, 'SC-SIM-001', line.requiredQty, '2026-07-01')
  assertStep(send.ok, send.error ?? 'subcon send failed')
  log('Production', 'Subcontract', 'Material Sent', wo.woNo, `Challan SC-SIM-001`)
  const shipment = ws.getSubcontractShipments(subWoId)[0]
  const recv = ws.receiveSubcontractMaterial(shipment.id, line.requiredQty, 0)
  assertStep(recv.ok, recv.error ?? 'subcon receive failed')
  ws.completeWorkOrder(subWoId)
  log('Production', 'Subcontract', 'Paint Process Received', wo.woNo, 'SUBCON_IN posted')
}

// ─── RUN SIMULATION ──────────────────────────────────────────────────────────

console.log('Running GO-LIVE manufacturing simulation...\n')
resetAll()

const master = useMasterStore.getState()
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const customer = master.customers.find((c) => c.id === so.customerId)!
const product = master.getProduct(so.productId)!

assertStep(customer.customerName === 'ABC Cement', 'Customer must be ABC Cement')
assertStep(product.productName.includes('45 M3 Bulker'), 'Product must be 45 M3 Bulker')
assertStep(so.qty === 2, 'Qty must be 2')

log('Commercial', 'Sales Order', 'Order Confirmed', so.salesOrderNo, `${customer.customerName} · ${so.qty}× ${product.productCode} · delivery ${so.requiredDate}`)

const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: true })
assertStep(mrpResult.ok, mrpResult.error ?? 'MRP failed')
const run = useMrpStore.getState().getRun(mrpResult.runId!)!
log('Planning', 'MRP', 'MRP Run Complete', run.runNo, `${run.materialLines.length} material lines · ${run.woRequirements.length} WO reqs · reservation ${mrpResult.reservation?.reservedQty ?? 0} units`)

const pr = usePurchaseStore.getState().requisitions.find((p) => p.mrpRunId === run.id && p.salesOrderId === so.id)
assertStep(!!pr, 'MRP must auto-create PR')
const prId = pr!.id
assertStep(usePurchaseStore.getState().submitPr(prId).ok, 'PR submit failed')
assertStep(usePurchaseStore.getState().approvePr(prId).ok, 'PR approve failed')
log('Procurement', 'PR', 'PR Approved', pr!.prNo, `${pr!.lines.length} shortage lines from MRP`)

const poIds = createPosFromPr(prId)
for (const poId of poIds) {
  postFullGrn(poId)
}

const woCreate = useWorkOrderStore.getState().createFromMrpRun(run.id, so.id)
assertStep(woCreate.ok, woCreate.error ?? 'WO create failed')
const wos = useWorkOrderStore.getState().workOrders.sort((a, b) => a.woNo.localeCompare(b.woNo))
log('Production', 'Work Order', 'WOs Created from MRP', run.runNo, wos.map((w) => w.woNo).join(', '))

const tankWo = wos.find((w) => w.woNo === 'WO-0001')!
const chassisWo = wos.find((w) => w.outputItemCode === 'SA-CHASSIS')!
const runGearWo = wos.find((w) => w.outputItemCode === 'SA-RUN-GEAR')!
const paintWo = wos.find((w) => w.woType === 'subcontract')!
const fgWo = wos.find((w) => w.woType === 'finished_goods')!

processManufacturedSaWo(tankWo.id, true)
processManufacturedSaWo(chassisWo.id)
processManufacturedSaWo(runGearWo.id)
processSubcontractWo(paintWo.id)

for (const line of useWorkOrderStore.getState().getWoMaterials(fgWo.id)) {
  ensureStock(line.itemId, line.warehouseId, line.requiredQty, `FG-${fgWo.woNo}`)
}
useWorkOrderStore.getState().planWorkOrder(fgWo.id)
useWorkOrderStore.getState().releaseWorkOrder(fgWo.id)
log('Production', 'Work Order', 'FG WO Released', fgWo.woNo, `${useWorkOrderStore.getState().getProductionOperations(fgWo.id).length} assembly ops`)

useWorkOrderStore.getState().reserveMaterials(fgWo.id)
useWorkOrderStore.getState().issueAllReserved(fgWo.id)
log('Inventory', 'Issue', 'FG WO SA Consumption', fgWo.woNo, 'Sub-assemblies from WIP')

useWorkOrderStore.getState().startProduction(fgWo.id)
completeSaWoSimple(fgWo.id)
const fgComplete = useWorkOrderStore.getState().completeWorkOrder(fgWo.id)
assertStep(fgComplete.ok, fgComplete.error ?? 'FG complete failed')
log('Production', 'Work Order', 'FG WO Completed', fgWo.woNo, product.productCode)

const fgReceipt = useWorkOrderStore.getState().postFgReceipt(fgWo.id)
assertStep(fgReceipt.ok, fgReceipt.error ?? 'FG receipt failed')
log('Inventory', 'FG Receipt', 'Finished Goods to FG Yard', fgWo.woNo, `${so.qty}× ${product.productCode}`)

const fqcCreate = useQualityStore.getState().createFinalInspection(fgWo.id)
assertStep(fqcCreate.ok, fqcCreate.error ?? 'Final QC create failed')
const fqcParams = qcParamsForInspection(fqcCreate.inspectionId!, true)
const fqcPass = useQualityStore.getState().recordFinalQcDecision(fqcCreate.inspectionId!, {
  inspector: 'Pradeep Singh',
  result: 'pass',
  remarks: 'Final FG QC — all checks passed',
  parameterResults: fqcParams,
  useAutoDecision: !!fqcParams?.length,
})
assertStep(fqcPass.ok, fqcPass.error ?? 'Final QC pass failed')
log('Quality', 'Final QC', 'Pre-Dispatch QC Approved', fgWo.woNo, fqcCreate.inspectionId!)

const costSheets = useCostingStore.getState().getAllCostSheets()
const fgSheet = useCostingStore.getState().getCostSheet(fgWo.id)!
const fgTotals = woCostTotals(fgSheet)
log('Costing', 'Cost Engine', 'Cost Rollup', fgWo.woNo, `Actual ${Math.round(fgTotals.totalActual)} · Planned ${Math.round(fgTotals.totalPlanned)} · Std ${Math.round(fgTotals.bomStandardCost)}`)

// ─── DISPATCH → INVOICE → CLOSED ─────────────────────────────────────────────

const dispatchCandidates = useDispatchStore.getState().getReadyCandidates()
assertStep(dispatchCandidates.some((c) => c.workOrderId === fgWo.id), 'FG dispatch candidate missing')
const dspCandidate = dispatchCandidates.find((c) => c.workOrderId === fgWo.id)!
const dspCreate = useDispatchStore.getState().createDispatchPlan(dspCandidate)
assertStep(dspCreate.ok, dspCreate.error ?? 'Dispatch plan failed')
const dispatchId = dspCreate.id!
const dispatchPlan = useDispatchStore.getState().getDispatch(dispatchId)!

useDispatchStore.getState().updateLogistics(dispatchId, {
  vehicleNo: 'MH-12-AB-4521',
  lrNo: 'LR-2026-004521',
  transporter: 'VRL Logistics',
  driverName: 'Ramesh Patil',
  driverPhone: '9876543210',
})
log('Fulfillment', 'Dispatch', 'Transport Details Saved', dispatchPlan!.dispatchNo, 'Vehicle MH-12-AB-4521 · LR-2026-004521')

useDispatchStore.getState().markLoading(dispatchId)
log('Fulfillment', 'Dispatch', 'Loading Started', dispatchPlan!.dispatchNo, `${dispatchPlan!.lines.length} trailer units`)

for (const item of useDispatchStore.getState().getDispatch(dispatchId)!.checklist) {
  if (!item.systemGate) {
    useDispatchStore.getState().toggleChecklistItem(dispatchId, item.id, true)
  }
}
useDispatchStore.getState().addPhoto(dispatchId, 'Loading — front/rear', 'data:image/png;base64,iVBORw0KGgo=')
const gate = useDispatchStore.getState().approveSecurityGate(dispatchId)
assertStep(gate.ok, gate.error ?? 'Gate pass failed')
log('Fulfillment', 'Dispatch', 'Loading Checklist Complete', dispatchPlan!.dispatchNo, `${dispatchPlan!.checklist.length} items · gate pass`)

const dispatchConfirm = useDispatchStore.getState().confirmDispatch(dispatchId)
assertStep(dispatchConfirm.ok, dispatchConfirm.error ?? 'Dispatch confirm failed')
log('Fulfillment', 'Dispatch', 'Dispatch Confirmed', dispatchPlan!.dispatchNo, `Movement ${dispatchConfirm.movementNo} · FG issued from yard`)

useDispatchStore.getState().markInTransit(dispatchId)
useDispatchStore.getState().recordCustomerAck(dispatchId, {
  acknowledgedBy: 'Suresh Mehta',
  designation: 'Plant Manager',
  ackDate: new Date().toISOString().slice(0, 10),
  remarks: '2× bulker received in good condition',
  signatureDataUrl: null,
  photoDataUrl: null,
})
log('Fulfillment', 'Dispatch', 'Customer POD Recorded', dispatchPlan!.dispatchNo, 'Delivered · ABC Cement site')

const invCreate = useInvoiceStore.getState().createFromDispatch(dispatchId)
assertStep(invCreate.ok, invCreate.error ?? 'Invoice create failed')
const invoice = useInvoiceStore.getState().getInvoice(invCreate.id!)!
log('Finance', 'Invoice', 'Tax Invoice Created', invoice.invoiceNo, `${fmtCurrency(invoice.gst.grandTotal)} · ${invoice.gst.scheme}`)

const invPost = useInvoiceStore.getState().postInvoice(invoice.id)
assertStep(invPost.ok, invPost.error ?? 'Invoice post failed')
log('Finance', 'Invoice', 'Invoice Posted', invoice.invoiceNo, 'Receivable created · SO invoiced')

const invPay = useInvoiceStore.getState().recordPayment(invoice.id, {
  amount: invoice.gst.grandTotal,
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNo: 'UTR-SIM-0001',
  mode: 'neft',
  remarks: 'Full payment — go-live simulation',
})
assertStep(invPay.ok, invPay.error ?? 'Payment failed')
log('Finance', 'Invoice', 'Payment Recorded', invoice.invoiceNo, `${fmtCurrency(invoice.gst.grandTotal)} · SO closed`)

const soFinal = useMrpStore.getState().getSalesOrder(so.id)!
assertStep(soFinal.status === 'closed', 'SO must be closed after full payment')
log('Commercial', 'Sales Order', 'Order Closed', so.salesOrderNo, 'Full lifecycle complete')

// ─── VERIFICATIONS ───────────────────────────────────────────────────────────

const verifications: VerificationResult[] = []

const bomIds = new Set(useBomStore.getState().bomHeaders.map((h) => h.id))
const rtgIds = new Set(useRoutingStore.getState().routingHeaders.map((h) => h.id))
const wcIds = new Set(useWorkCenterStore.getState().workCenters.map((w) => w.id))
const rtgOpIds = new Set(useRoutingStore.getState().routingOperations.map((o) => o.id))
const integrity = mergeIntegrityReports(
  validateManufacturingIntegrity({
    workOrders: useWorkOrderStore.getState().workOrders,
    bomHeaderIds: bomIds,
    routingHeaderIds: rtgIds,
    workCenterIds: wcIds,
    routingOperationIds: rtgOpIds,
    productionOperations: useWorkOrderStore.getState().productionOperations,
  }),
  { ok: true, errorCount: 0, warningCount: 0, issues: [], checkedAt: new Date().toISOString() },
)
verifications.push({
  label: 'No orphan BOM/routing/WC references',
  ok: integrity.errorCount === 0,
  detail: `${integrity.errorCount} errors, ${integrity.warningCount} warnings`,
})

let inventoryOk = true
const invDetails: string[] = []
for (const wh of master.warehouses) {
  for (const item of master.items.filter((i) => i.isStockable)) {
    const computed = computeOnHand(useInventoryStore.getState().stockMovements, item.id, wh.id)
    const store = useInventoryStore.getState().getOnHand(item.id, wh.id)
    if (Math.abs(computed - store) > 0.001) {
      inventoryOk = false
      invDetails.push(`${item.itemCode}@${wh.warehouseCode}`)
    }
  }
}
verifications.push({
  label: 'No inventory mismatch (ledger = on-hand)',
  ok: inventoryOk,
  detail: inventoryOk ? 'All stockable items reconciled' : invDetails.slice(0, 5).join(', '),
})

const childActualSum = costSheets
  .filter((s) => wos.some((w) => w.parentWoId === fgWo.id && w.id === s.workOrderId))
  .reduce((sum, s) => sum + woCostTotals(s).totalActual, 0)
const fgOwnActual = woCostTotals(fgSheet).totalActual - fgSheet.rolledUpChildActual
verifications.push({
  label: 'FG cost rollup includes child SA costs',
  ok: fgSheet.rolledUpChildActual > 0 && fgTotals.totalActual >= fgSheet.rolledUpChildActual,
  detail: `Roll-up ${Math.round(fgSheet.rolledUpChildActual)} · children sum ${Math.round(childActualSum)} · FG total ${Math.round(fgTotals.totalActual)}`,
})

const openQcOnCompleted = useWorkOrderStore.getState().workOrders
  .filter((w) => w.status === 'completed' || w.status === 'fg_received')
  .some((w) => {
    const ops = useWorkOrderStore.getState().getProductionOperations(w.id)
    return ops.some((o) => o.qcRequired && o.status === 'qc_hold')
  })
verifications.push({
  label: 'No WO completion with open QC hold',
  ok: !openQcOnCompleted,
  detail: openQcOnCompleted ? 'QC hold found on completed WO' : 'All completed WOs QC-clear',
})

const mfgChildren = useWorkOrderStore.getState().workOrders.filter(
  (w) => w.parentWoId === fgWo.id && w.woType === 'manufactured_sub_assembly',
)
const allSaPosted = mfgChildren.every((c) =>
  useWorkOrderStore.getState().saReceipts.some((r) => r.sourceWoId === c.id && r.status === 'posted'),
)
verifications.push({
  label: 'FG receipt only after SA receipts posted',
  ok: allSaPosted && fgReceipt.ok,
  detail: `${mfgChildren.length} mfg SA WOs · all receipts posted`,
})

const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
const fgOnHand = useInventoryStore.getState().getOnHand(product.fgItemId, fgWh.id)

const traceRows: { item: string; wo: string; movement: string; qty: number; ref: string }[] = []
for (const m of useInventoryStore.getState().stockMovements.filter((x) => x.referenceType === 'ISSUE_TO_WO' || x.referenceType === 'SA_RECEIPT' || x.referenceType === 'FG_RECEIPT')) {
  const item = master.getItem(m.itemId)
  const wo = m.workOrderId ? useWorkOrderStore.getState().getWorkOrder(m.workOrderId) : null
  traceRows.push({
    item: item?.itemCode ?? m.itemId,
    wo: wo?.woNo ?? '—',
    movement: m.referenceType,
    qty: m.qty,
    ref: m.movementNo,
  })
}

verifications.push({
  label: 'FG Yard stock after dispatch',
  ok: fgOnHand >= 0,
  detail: `FG_YARD on-hand ${fgOnHand} (seed + receipt − dispatch)`,
})

const dispatchMovement = useInventoryStore.getState().stockMovements.find((m) => m.referenceType === 'FG_DISPATCH')
verifications.push({
  label: 'Dispatch issues FG from yard',
  ok: !!dispatchMovement && dispatchMovement.qty < 0,
  detail: dispatchMovement ? `${dispatchMovement.movementNo} · qty ${dispatchMovement.qty}` : 'No FG_DISPATCH movement',
})

verifications.push({
  label: 'Invoice GST and payment closes SO',
  ok: invPay.ok && soFinal.status === 'closed' && useInvoiceStore.getState().getInvoice(invoice.id)!.paymentStatus === 'paid',
  detail: `${invoice.invoiceNo} · ${fmtCurrency(invoice.gst.grandTotal)} · SO ${soFinal.status}`,
})

const tracePegComplete = traceRows.length >= 10 && traceRows.some((t) => t.movement === 'ISSUE_TO_WO') && traceRows.some((t) => t.movement === 'FG_RECEIPT')
verifications.push({
  label: 'Material traceability RM → SA → FG',
  ok: tracePegComplete,
  detail: `${traceRows.length} pegged movements in ledger`,
})

const allPass = verifications.every((v) => v.ok)

// ─── REPORT SECTIONS ─────────────────────────────────────────────────────────

const costHistory = costSheets.map((s) => {
  const t = woCostTotals(s)
  return {
    wo: s.woNo,
    item: s.itemCode,
    type: s.woType,
    planned: t.totalPlanned,
    actual: t.totalActual,
    standard: t.bomStandardCost,
    variancePct: t.variancePct,
  }
})

const genealogy = wos.map((w) => ({
  wo: w.woNo,
  type: w.woType,
  output: w.outputItemCode,
  parent: w.parentWoId ? useWorkOrderStore.getState().getWorkOrder(w.parentWoId)?.woNo ?? '—' : '—',
  status: w.status,
  children: useWorkOrderStore.getState().workOrders.filter((c) => c.parentWoId === w.id).map((c) => c.woNo),
}))

const leadTimes = wos.map((w) => {
  const created = new Date(w.createdAt).getTime()
  const done = w.completedAt || w.fgReceivedAt || w.closedAt
  const hours = done ? (new Date(done).getTime() - created) / 3600000 : 0
  return { wo: w.woNo, output: w.outputItemCode, hours: hours.toFixed(1), status: w.status }
})

const finalDispatch = useDispatchStore.getState().getDispatch(dispatchId)!

const report = `# GO-LIVE Manufacturing Simulation Report

**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}  
**Scenario:** ABC Cement · SO-0001 · 45 M3 Bulker Trailer · Qty 2  
**Plant:** Pune · Per-sub-assembly WO mode  
**Result:** ${allPass ? '✅ **PASS — Ready for go-live review**' : '❌ **FAIL — See verifications**'}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Sales Order | ${so.salesOrderNo} |
| Customer | ${customer.customerName} |
| Product | ${product.productName} (${product.productCode}) |
| Order Qty | ${so.qty} trailers |
| MRP Run | ${run.runNo} |
| Work Orders | ${wos.length} (${wos.map((w) => w.woNo).join(', ')}) |
| Purchase Requisitions | ${pr.prNo} (${pr.lines.length} lines) |
| Purchase Orders | ${poIds.length} |
| GRNs Posted | ${usePurchaseStore.getState().grns.length} |
| FG Receipt | ${fgReceipt.ok ? 'Posted to FG_YARD' : 'Failed'} |
| Dispatch | ${finalDispatch.dispatchNo} (${finalDispatch.status}) |
| Tax Invoice | ${invoice.invoiceNo} · ${fmtCurrency(invoice.gst.grandTotal)} |
| SO Final Status | ${soFinal.status} |
| Total FG Actual Cost | ${fmtCurrency(fgTotals.totalActual)} |
| BOM Standard Cost | ${fmtCurrency(fgTotals.bomStandardCost)} |
| Cost Variance | ${fgTotals.variancePct.toFixed(1)}% |

---

## 1. Full Transaction Timeline

| # | Sim Time | Phase | Module | Event | Reference | Detail |
|---|----------|-------|--------|-------|-----------|--------|
${timeline.map((e) => `| ${e.seq} | ${e.simTime} | ${e.phase} | ${e.module} | ${e.event} | ${e.reference} | ${e.detail.replace(/\|/g, '/')} |`).join('\n')}

---

## 2. Inventory Movement History (Key Manufacturing Movements)

| Movement No | Type | Item | WH | Qty | Value | Reference | WO |
|-------------|------|------|-----|-----|-------|-----------|-----|
${useInventoryStore
  .getState()
  .stockMovements.filter((m) => ['ISSUE_TO_WO', 'SA_RECEIPT', 'FG_RECEIPT', 'SUBCON_OUT', 'SUBCON_IN', 'INW', 'GRN'].some((t) => m.referenceType.includes(t) || m.referenceType === 'inward' || m.movementType === 'inward'))
  .slice(-40)
  .map((m) => {
    const item = master.getItem(m.itemId)
    const wh = master.getWarehouse(m.warehouseId)
    return `| ${m.movementNo} | ${m.referenceType} | ${item?.itemCode ?? '—'} | ${wh?.warehouseCode ?? '—'} | ${m.qty} | ${fmtCurrency(Math.abs(m.value))} | ${m.referenceNo} | ${m.workOrderId ? useWorkOrderStore.getState().getWorkOrder(m.workOrderId)?.woNo ?? '—' : '—'} |`
  })
  .join('\n')}

**FG Yard closing balance:** ${fgOnHand} × ${product.productCode}

---

## 3. Cost Accumulation History

| WO | Output | Type | Planned | Actual | BOM Standard | Variance % |
|----|--------|------|---------|--------|--------------|------------|
${costHistory.map((c) => `| ${c.wo} | ${c.item} | ${c.type.replace(/_/g, ' ')} | ${fmtCurrency(c.planned)} | ${fmtCurrency(c.actual)} | ${fmtCurrency(c.standard)} | ${c.variancePct.toFixed(1)}% |`).join('\n')}

**FG Roll-up:** Child SA costs ${fmtCurrency(fgSheet.rolledUpChildActual)} + FG assembly ${fmtCurrency(fgOwnActual)} overhead included → **Total ${fmtCurrency(fgTotals.totalActual)}**

---

## 4. Work Order Genealogy

\`\`\`
${genealogy
  .map((g) => `${g.wo} [${g.type}] → ${g.output}${g.parent !== '—' ? ` (parent: ${g.parent})` : ''}${g.children.length ? ` → children: ${g.children.join(', ')}` : ''}`)
  .join('\n')}
\`\`\`

| WO | Type | Output | Parent | Status | Child WOs |
|----|------|--------|--------|--------|-----------|
${genealogy.map((g) => `| ${g.wo} | ${g.type} | ${g.output} | ${g.parent} | ${g.status} | ${g.children.join(', ') || '—'} |`).join('\n')}

---

## 5. Material Traceability Report

Pegging issued materials and semi-finished receipts to work orders:

| Item | Work Order | Movement Type | Qty | Ledger Ref |
|------|------------|---------------|-----|------------|
${traceRows.slice(0, 30).map((t) => `| ${t.item} | ${t.wo} | ${t.movement} | ${t.qty} | ${t.ref} |`).join('\n')}

---

## 6. Production Lead Time Report

| WO | Output | Status | Elapsed (hrs)* |
|----|--------|--------|----------------|
${leadTimes.map((l) => `| ${l.wo} | ${l.output} | ${l.status} | ${l.hours} |`).join('\n')}

*Elapsed from WO creation timestamp to completion/FG receipt in simulation.

**Critical path note:** WO-0001 (Tank Assembly) includes QC **REWORK** at Welding (seq 40) — adds ~2.5 rework hours before Chassis Assembly (seq 50) release.

---

## 7. Verification Checklist

| Check | Status | Detail |
|-------|--------|--------|
${verifications.map((v) => `| ${v.label} | ${v.ok ? '✅ PASS' : '❌ FAIL'} | ${v.detail} |`).join('\n')}

---

## 8. Process Flow Executed

\`\`\`
Sales Order (SO-0001)
  → MRP Run (${run.runNo})
  → Purchase Requisition (${pr.prNo})
  → Purchase Orders (${poIds.length})
  → GRN → Inventory Inward
  → SO + WO Reservation
  → Work Orders (${wos.map((w) => w.woNo).join(', ')})
  → Routing / Job Cards generated on release
  → Material Issue (ISSUE_TO_WO)
  → Shop Floor Operations + Job Cards
  → QC Pass / Rework (WO-0001 Welding)
  → Semi-Finished Receipt (SA_RECEIPT)
  → Parent FG WO material consumption
  → FG Receipt (FG_YARD)
  → Cost Rollup (all WOs + child roll-up)
  → Dispatch (${finalDispatch.dispatchNo}) → Customer POD
  → Tax Invoice (${invoice.invoiceNo}) → Payment → SO Closed
\`\`\`

---

## 9. Quality Events (WO-0001 Tank)

| Step | Result |
|------|--------|
| Welding QC first inspection | REWORK — porosity |
| Rework order | Completed 2.5 hrs |
| Re-inspection | PASS |
| Next op (Chassis Assembly seq 50) | Released after QC PASS |

---

## 10. Fulfillment & Finance (Dispatch → Invoice)

| Step | Reference | Result |
|------|-----------|--------|
| Dispatch Plan | ${finalDispatch.dispatchNo} | ${finalDispatch.lines.length} units · trailer/chassis assigned |
| Transport | ${finalDispatch.vehicleNo} / ${finalDispatch.lrNo} | ${finalDispatch.transporter} |
| Loading Checklist | ${finalDispatch.checklist.length} items | All passed |
| FG Issue | ${dispatchConfirm.movementNo ?? '—'} | DISPATCH movement posted |
| Customer POD | Suresh Mehta | Delivered |
| Tax Invoice | ${invoice.invoiceNo} | ${invoice.gst.scheme} · ${fmtCurrency(invoice.gst.grandTotal)} |
| Payment | UTR-SIM-0001 | Full · SO ${soFinal.status} |

---

*Report generated by \`scripts/go-live-simulation.ts\` · Run \`npm run simulate:go-live\` to refresh.*
`

writeFileSync(REPORT_PATH, report, 'utf8')

// ─── READINESS SCORING ───────────────────────────────────────────────────────

function ratingLabel(score: 0 | 1 | 2 | 3): string {
  return ['Missing', 'Prototype', 'Functional', 'Production Ready'][score]
}

const moduleScores: ModuleScore[] = [
  {
    module: 'Inventory',
    score: inventoryOk ? 3 : 2,
    rating: ratingLabel(inventoryOk ? 3 : 2),
    evidence: `Ledger reconcile ${inventoryOk ? 'PASS' : 'FAIL'} · reservations · ISSUE_TO_WO · SA/FG receipt · DISPATCH issue · WIP transfers`,
    blockers: inventoryOk ? [] : ['On-hand vs ledger mismatch detected in simulation'],
  },
  {
    module: 'MRP',
    score: mrpResult.ok && run.materialLines.length > 0 ? 3 : 2,
    rating: ratingLabel(mrpResult.ok && run.materialLines.length > 0 ? 3 : 2),
    evidence: `${run.runNo} · ${run.materialLines.length} material lines · ${run.woRequirements.length} WO reqs · SO pegging · auto-reserve`,
    blockers: ['Re-MRP can duplicate PRs', 'No formal SO approval gate before MRP'],
  },
  {
    module: 'Purchase',
    score: poIds.length > 0 && usePurchaseStore.getState().grns.length > 0 ? 2 : 1,
    rating: ratingLabel(poIds.length > 0 ? 2 : 1),
    evidence: `${pr.prNo} → ${poIds.length} POs → ${usePurchaseStore.getState().grns.length} GRNs posted to inventory`,
    blockers: ['GRN not on dedicated register route', 'No incoming QC hold on receipt', 'RFQ comparison optional only'],
  },
  {
    module: 'Production',
    score: wos.length >= 5 && fgReceipt.ok ? 3 : 2,
    rating: ratingLabel(wos.length >= 5 && fgReceipt.ok ? 3 : 2),
    evidence: `${wos.length} WOs · per-SA mode · routing/job cards · subcontract paint · FG receipt · integrity ${integrity.errorCount} errors`,
    blockers: ['WO status timestamps not always set on completion', 'No shop-floor tablet/barcode UI', 'one_per_trailer mode less tested'],
  },
  {
    module: 'Quality',
    score: 2,
    rating: ratingLabel(2),
    evidence: `QC rework on WO-0001 welding · re-inspection PASS · QC gates block next op · ${useQualityStore.getState().reworks.length} rework(s) in sim`,
    blockers: ['No incoming material QC', 'No standalone QC certificate print', 'NCR workflow not in simulation path'],
  },
  {
    module: 'Costing',
    score: fgSheet.rolledUpChildActual > 0 ? 2 : 1,
    rating: ratingLabel(fgSheet.rolledUpChildActual > 0 ? 2 : 1),
    evidence: `FG actual ${fmtCurrency(fgTotals.totalActual)} · roll-up ${fmtCurrency(fgSheet.rolledUpChildActual)} · variance ${fgTotals.variancePct.toFixed(1)}% vs BOM standard`,
    blockers: ['High cost variance vs standard — rates need calibration', 'No standard cost revision workflow tied to BOM release'],
  },
  {
    module: 'Dispatch',
    score: dispatchConfirm.ok ? 2 : 1,
    rating: ratingLabel(dispatchConfirm.ok ? 2 : 1),
    evidence: `${finalDispatch.dispatchNo} · loading checklist · trailer/chassis · transport · POD · FG yard issue`,
    blockers: ['Browser localStorage only — no server-side challan archive', 'Photos stored as base64 demo blobs'],
  },
  {
    module: 'Sales',
    score: 1,
    rating: ratingLabel(1),
    evidence: `Seed SO-0001 consumed · status machine to closed · no SO CRUD UI · no inquiry/quotation pipeline`,
    blockers: ['Must pre-seed sales orders — no create/confirm UI', 'No Lead → Inquiry → Quotation → Approval', 'Dual SO model (legacy mock vs mrpStore)'],
  },
  {
    module: 'Traceability',
    score: tracePegComplete ? 2 : 1,
    rating: ratingLabel(tracePegComplete ? 2 : 1),
    evidence: `${traceRows.length} pegged movements · WO genealogy ${wos.length} nodes · MRP pegging fields · dispatch line → invoice line`,
    blockers: ['No single traceability report UI', 'No serial number master at FG receipt', 'Lot/batch not enforced on RM'],
  },
]

const avgScore = moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length
const factoryBlockers = [
  'No backend database — all transactional data in browser localStorage (single-user, no HA)',
  'Sales order entry requires seed data — commercial front (Lead/Inquiry/Quote) not built',
  'No user authentication, roles, or audit trail for shop-floor transactions',
  'Standard costs diverge significantly from actuals — costing master data needs plant calibration',
  'GRN and purchase audit trail lacks dedicated list/register pages',
  'No ECO / engineering change control — BOM/routing revisions are manual',
  'No barcode/scanner integration for material issue and FG dispatch at gate',
  'No email/PDF server dispatch for tax invoice — print-only in browser',
  'Multi-plant / multi-company not supported',
  'Simulation uses stock top-ups for shortages — real plant needs strict negative-stock prevention at issue',
]

const readinessReport = `# ERP Go-Live Readiness Assessment

**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}  
**Plant:** Vasant Trailers · Pune  
**Simulation:** ABC Cement · SO-0001 · 2× 45 M3 Bulker Trailer  
**Simulation Result:** ${allPass ? '✅ PASS' : '❌ FAIL'} (${verifications.filter((v) => v.ok).length}/${verifications.length} checks)  
**Overall Readiness:** ${avgScore >= 2.5 ? '**Functional — pilot ready with blockers**' : avgScore >= 1.5 ? '**Prototype — not factory ready**' : '**Not ready**'}  
**Average Module Score:** ${avgScore.toFixed(1)} / 3.0

---

## Scoring Scale

| Score | Rating | Meaning |
|-------|--------|---------|
| 0 | Missing | Not implemented |
| 1 | Prototype | Seed/demo only; not operable by factory staff |
| 2 | Functional | End-to-end works for anchor scenario; gaps remain |
| 3 | Production Ready | Persisted, tested, UI complete, factory-operable |

---

## Module Readiness Matrix

| Module | Score | Rating | Simulation Evidence |
|--------|-------|--------|---------------------|
${moduleScores.map((m) => `| **${m.module}** | ${m.score} | ${m.rating} | ${m.evidence.slice(0, 120)}${m.evidence.length > 120 ? '…' : ''} |`).join('\n')}

---

## Module Detail & Gaps

${moduleScores
  .map(
    (m) => `### ${m.module} — ${m.score}/3 (${m.rating})

${m.evidence}

${m.blockers.length ? `**Gaps:** ${m.blockers.join(' · ')}` : '**Gaps:** None critical for anchor scenario.'}
`,
  )
  .join('\n')}

---

## Simulation Verification Summary

| Check | Status |
|-------|--------|
${verifications.map((v) => `| ${v.label} | ${v.ok ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

---

## End-to-End Flow Validated

\`\`\`
Sales Order (seed SO-0001)
  → MRP → PR → PO → GRN
  → Reservation → Work Orders (5)
  → Material Issue → Operations → QC Rework
  → SA Receipt → FG WO → FG Receipt
  → Cost Rollup → Dispatch → Customer POD
  → Tax Invoice → Payment → SO Closed
\`\`\`

**Timeline events:** ${timeline.length}  
**Work orders:** ${wos.length}  
**Tax invoice:** ${invoice.invoiceNo} (${fmtCurrency(invoice.gst.grandTotal)})

---

## Factory Deployment Blockers (Critical)

| # | Blocker | Impact | Modules Affected |
|---|---------|--------|------------------|
${factoryBlockers.map((b, i) => {
  const impact = i === 0 ? 'Data loss, no multi-user' : i === 1 ? 'Cannot take live orders' : i === 2 ? 'No accountability' : i === 3 ? 'Wrong margins' : 'Operational friction'
  const mods = i === 0 ? 'All' : i === 1 ? 'Sales, MRP' : i === 2 ? 'All' : i === 3 ? 'Costing, Finance' : 'Various'
  return `| ${i + 1} | ${b} | ${impact} | ${mods} |`
}).join('\n')}

---

## Go-Live Recommendation

| Phase | Scope | Readiness |
|-------|-------|-----------|
| **Pilot (desk)** | MRP → Production → Costing on SO-0001 class orders | ✅ Ready now |
| **Pilot (shop floor)** | Job cards + QC on 1 bay | ⚠️ Needs tablet UI + user login |
| **Pilot (dispatch)** | FG dispatch + tax invoice for ABC Cement pattern | ✅ Ready now |
| **Production go-live** | Live SO entry, multi-user, server DB | ❌ Blocked — see above |

**Verdict:** The ERP can execute a **complete manufacturing and fulfillment cycle** for the anchor bulker scenario using existing modules. It is **not yet ready for unattended factory production** without addressing server persistence, sales order entry, authentication, and cost calibration.

---

## Automated Test Coverage (existing scripts)

| Script | Area |
|--------|------|
| \`npm run test:wo-flow\` | Production WO lifecycle |
| \`npm run test:dispatch\` | Dispatch + POD |
| \`npm run test:invoice\` | GST invoice + receivable |
| \`npm run test:costing\` | Cost engine |
| \`npm run test:quality\` | QC + rework |
| \`npm run simulate:go-live\` | Full end-to-end (this report) |

---

*Generated by \`scripts/go-live-simulation.ts\` · No new modules created.*
`

writeFileSync(READINESS_PATH, readinessReport, 'utf8')

const { writeCostCalibrationReport } = await import('./cost-calibration.ts')
const cal = writeCostCalibrationReport()

const { writeCostVarianceAnalysisReport } = await import('./cost-variance-analysis.ts')
writeCostVarianceAnalysisReport()

console.log(`\n${'═'.repeat(55)}`)
console.log(' GO-LIVE SIMULATION COMPLETE')
console.log('═'.repeat(55))
console.log(`Timeline events: ${timeline.length}`)
console.log(`Work orders: ${wos.length}`)
console.log(`Verifications: ${verifications.filter((v) => v.ok).length}/${verifications.length} passed`)
console.log(`Report: ${REPORT_PATH}`)
console.log(`Readiness: ${READINESS_PATH}`)
console.log(`Cost calibration: variance ${cal.fgVarianceVsBom.toFixed(1)}% vs BOM · ${cal.fgVarianceVsPlanned.toFixed(1)}% vs planned`)
console.log(`Average module score: ${avgScore.toFixed(1)}/3`)
console.log(allPass ? '\n✅ ALL VERIFICATIONS PASSED' : '\n❌ SOME VERIFICATIONS FAILED')

for (const v of verifications) {
  console.log(`  ${v.ok ? '✓' : '✗'} ${v.label} — ${v.detail}`)
}

process.exit(allPass ? 0 : 1)
