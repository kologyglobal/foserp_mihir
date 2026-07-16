/**
 * Shared go-live manufacturing scenario — SO-0001 ABC Cement closed loop.
 * Used by demo data loader and go-live simulation script.
 */
import { seedSalesOrders } from '../../data/mrp/seed'
import { seedStockMovements, seedReservations } from '../../data/inventory/seed'
import { DEMO_WO_ANCHORS } from '../../data/production/woAnchors'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMrpStore } from '../../store/mrpStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useCostingStore } from '../../store/costingStore'
import { useFreezeStore } from '../../store/freezeStore'
import { buildEmptyParameterResults } from '../../utils/qcPlanResolver'
import type { QcParameterResult } from '../../types/qcParameters'
import { canStartOperation } from '../../utils/qualityEngine'
import { costSheetTotals as woCostTotals } from '../../types/costing'

export interface GoLiveScenarioResult {
  ok: boolean
  error?: string
  soId?: string
}

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

function log(_phase: string, _module: string, _event: string, _reference: string, _detail: string) {}

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
      remarks: 'Completed',
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


export function runGoLiveScenario(): GoLiveScenarioResult {
  try {
    resetAll()
    const master = useMasterStore.getState()
    let so = useMrpStore.getState().salesOrders.find((s) => s.salesOrderNo === 'SO-0001')
    if (!so) {
      const anchor = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
      useMrpStore.setState((s) => ({ salesOrders: [anchor, ...s.salesOrders] }))
      so = anchor
    }
    if (so.status !== 'confirmed' && so.status !== 'in_production') {
      useMrpStore.setState((s) => ({
        salesOrders: s.salesOrders.map((row) =>
          row.id === so!.id ? { ...row, status: 'confirmed' as const } : row,
        ),
      }))
      so = useMrpStore.getState().getSalesOrder(so.id)!
    }
    const customer = master.customers.find((c) => c.id === so.customerId)!
    const product = master.getProduct(so.productId)!
    assertStep(customer.customerName === 'ABC Cement', 'Customer must be ABC Cement')
    assertStep(product.productName.includes('45 M3 Bulker'), 'Product must be 45 M3 Bulker')
    assertStep(so.qty === 2, 'Qty must be 2')
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

const tankWo = wos.find((w) => w.outputItemCode === DEMO_WO_ANCHORS.tankOutputItemCode)
const chassisWo = wos.find((w) => w.outputItemCode === 'SA-CHASSIS')
const runGearWo = wos.find((w) => w.outputItemCode === 'SA-RUN-GEAR')
const paintWo = wos.find((w) => w.woType === 'subcontract')
const fgWo = wos.find((w) => w.woType === 'finished_goods')
assertStep(!!tankWo, `Tank WO (${DEMO_WO_ANCHORS.tankOutputItemCode}) missing — got ${wos.map((w) => w.outputItemCode).join(', ')}`)
assertStep(!!chassisWo, 'Chassis WO (SA-CHASSIS) missing')
assertStep(!!runGearWo, 'Running gear WO (SA-RUN-GEAR) missing')
assertStep(!!paintWo, 'Subcontract paint WO missing')
assertStep(!!fgWo, 'Finished goods WO missing')

processManufacturedSaWo(tankWo!.id, true)
processManufacturedSaWo(chassisWo!.id)
processManufacturedSaWo(runGearWo!.id)
processSubcontractWo(paintWo!.id)

for (const line of useWorkOrderStore.getState().getWoMaterials(fgWo!.id)) {
  ensureStock(line.itemId, line.warehouseId, line.requiredQty, `FG-${fgWo!.woNo}`)
}
useWorkOrderStore.getState().planWorkOrder(fgWo!.id)
useWorkOrderStore.getState().releaseWorkOrder(fgWo!.id)
log('Production', 'Work Order', 'FG WO Released', fgWo!.woNo, `${useWorkOrderStore.getState().getProductionOperations(fgWo!.id).length} assembly ops`)

useWorkOrderStore.getState().reserveMaterials(fgWo!.id)
useWorkOrderStore.getState().issueAllReserved(fgWo!.id)
log('Inventory', 'Issue', 'FG WO SA Consumption', fgWo!.woNo, 'Sub-assemblies from WIP')

useWorkOrderStore.getState().startProduction(fgWo!.id)
completeSaWoSimple(fgWo!.id)
const fgComplete = useWorkOrderStore.getState().completeWorkOrder(fgWo!.id)
assertStep(fgComplete.ok, fgComplete.error ?? 'FG complete failed')
log('Production', 'Work Order', 'FG WO Completed', fgWo!.woNo, product.productCode)

const fgReceipt = useWorkOrderStore.getState().postFgReceipt(fgWo!.id)
assertStep(fgReceipt.ok, fgReceipt.error ?? 'FG receipt failed')
log('Inventory', 'FG Receipt', 'Finished Goods to FG Yard', fgWo!.woNo, `${so.qty}× ${product.productCode}`)

const fqcCreate = useQualityStore.getState().createFinalInspection(fgWo!.id)
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
log('Quality', 'Final QC', 'Pre-Dispatch QC Approved', fgWo!.woNo, fqcCreate.inspectionId!)

const fgSheet = useCostingStore.getState().getCostSheet(fgWo!.id)!
const fgTotals = woCostTotals(fgSheet)
log('Costing', 'Cost Engine', 'Cost Rollup', fgWo!.woNo, `Actual ${Math.round(fgTotals.totalActual)} · Planned ${Math.round(fgTotals.totalPlanned)} · Std ${Math.round(fgTotals.bomStandardCost)}`)

// ─── DISPATCH → INVOICE → CLOSED ─────────────────────────────────────────────

const dispatchCandidates = useDispatchStore.getState().getReadyCandidates()
assertStep(dispatchCandidates.some((c) => c.workOrderId === fgWo!.id), 'FG dispatch candidate missing')
const dspCandidate = dispatchCandidates.find((c) => c.workOrderId === fgWo!.id)!
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


    return { ok: true, soId: so.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
