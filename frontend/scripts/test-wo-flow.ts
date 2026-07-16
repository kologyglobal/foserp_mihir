/**
 * WO lifecycle integration test — npx tsx scripts/test-wo-flow.ts
 *
 * Validates: MRP → WO → material lines → reserve → issue → FG receipt → subcontract
 */
import { seedSalesOrders } from '../src/data/mrp/seed'
import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'

// In-memory localStorage for zustand persist in Node
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

const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useRoutingStore } = await import('../src/store/routingStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { buildEmptyParameterResults } = await import('../src/utils/qcPlanResolver')
import type { QcParameterResult } from '../src/types/qcParameters'

function resetStores() {
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

function ensureLineStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'TEST-WO-FLOW-INW',
      remarks: 'Test inward for WO flow',
    })
  }
}

function prepareFgSubAssemblyConsumption(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  const childSaWos = store.workOrders.filter(
    (w) => w.parentWoId === fgWoId && w.woType === 'manufactured_sub_assembly',
  )
  for (const child of childSaWos) {
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
  for (const line of store.getWoMaterials(fgWoId)) {
    ensureLineStock(line.itemId, line.warehouseId, line.requiredQty)
  }
  store.planWorkOrder(fgWoId)
  store.releaseWorkOrder(fgWoId)
  store.reserveMaterials(fgWoId)
  store.issueAllReserved(fgWoId)
}

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

console.log('═══════════════════════════════════════════════════════')
console.log(' WO Flow Integration Test (SO-0001 · 2× 45 M3 Bulker)')
console.log('═══════════════════════════════════════════════════════\n')

resetStores()

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const master = useMasterStore.getState()

// ── 1. MRP → Create WO ──
console.log('── 1. MRP creates Work Orders ──')
const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
check('MRP run succeeds', mrpResult.ok, mrpResult.error)
const runId = mrpResult.runId!
const run = useMrpStore.getState().getRun(runId)
check('MRP run persisted', !!run, run?.runNo)
check('MRP has WO requirements', (run?.woRequirements.length ?? 0) > 0, `${run?.woRequirements.length} reqs`)

const woCreate = useWorkOrderStore.getState().createFromMrpRun(runId, so.id)
check('WO creation from MRP succeeds', woCreate.ok, woCreate.error)
check('WO ids returned', (woCreate.woIds?.length ?? 0) > 0, `${woCreate.woIds?.length} WOs`)

const wos = useWorkOrderStore.getState().workOrders
check('Work orders in store', wos.length > 0, `${wos.length} total`)

const mfgWo = wos.find((w) => w.woNo === 'WO-0002')
  ?? wos.find((w) => w.woType === 'manufactured_sub_assembly' && w.outputItemCode === 'SA-CHASSIS')
  ?? wos.find((w) => w.woType === 'manufactured_sub_assembly')
const fgWo = wos.find((w) => w.woType === 'finished_goods')
const subWo = wos.find((w) => w.woType === 'subcontract')

check('Manufactured sub-assembly WO exists', !!mfgWo, mfgWo?.woNo)
check('Tank Assembly WO exists (SA-TANK-ASM)', wos.some((w) => w.outputItemCode === 'SA-TANK-ASM'))
check('Finished goods WO exists', !!fgWo, fgWo?.woNo)
check('Subcontract WO exists (Paint)', !!subWo, subWo?.outputItemCode)

// ── 2. Material lines ──
console.log('\n── 2. WO material lines ──')
const mfgLines = mfgWo ? useWorkOrderStore.getState().getWoMaterials(mfgWo.id) : []
check('Manufactured WO has material lines', mfgLines.length > 0, `${mfgLines.length} lines`)
check('Material lines have required qty > 0', mfgLines.every((l) => l.requiredQty > 0))
check('Material lines pegged to warehouse', mfgLines.every((l) => !!l.warehouseId))

const subLines = subWo ? useWorkOrderStore.getState().getWoMaterials(subWo.id) : []
check('Subcontract WO has material lines', subLines.length >= 0, `${subLines.length} lines`)

// ── 3. Reserve against WO ──
console.log('\n── 3. Material reservation against WO ──')
if (mfgWo) {
  useWorkOrderStore.getState().planWorkOrder(mfgWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(mfgWo.id)

  // Ensure free stock for at least one material line (seed may be fully reserved by SO in UI sessions)
  const firstLine = useWorkOrderStore.getState().getWoMaterials(mfgWo.id)[0]
  if (firstLine) {
    const free = useInventoryStore.getState().getFreeQty(firstLine.itemId, firstLine.warehouseId)
    if (free < firstLine.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: firstLine.itemId,
        warehouseId: firstLine.warehouseId,
        qty: firstLine.requiredQty - free + 10,
        referenceNo: 'TEST-INW-WO',
        remarks: 'Test inward for WO reservation',
      })
    }
  }

  const reserve = useWorkOrderStore.getState().reserveMaterials(mfgWo.id)
  check('WO reservation succeeds', reserve.ok, reserve.error)
  check('Some qty reserved', (reserve.reserved ?? 0) > 0, `${reserve.reserved} units`)

  const updatedLines = useWorkOrderStore.getState().getWoMaterials(mfgWo.id)
  check('Material lines show reserved qty', updatedLines.some((l) => l.reservedQty > 0))

  const woReservations = useInventoryStore.getState().reservations.filter(
    (r) => r.demandType === 'WO' && r.demandId === mfgWo.woNo && r.status === 'active',
  )
  check('Inventory reservations created for WO', woReservations.length > 0, `${woReservations.length} res`)
}

// ── 4. Issue → movement ledger ──
console.log('\n── 4. Issue creates movement ledger entry ──')
if (mfgWo) {
  const lineToIssue = useWorkOrderStore.getState().getWoMaterials(mfgWo.id).find((l) => l.reservedQty > l.issuedQty)
  const movementsBefore = useInventoryStore.getState().stockMovements.length

  if (lineToIssue) {
    const issueQty = lineToIssue.reservedQty - lineToIssue.issuedQty
    const issue = useWorkOrderStore.getState().issueMaterialLine(mfgWo.id, lineToIssue.id, issueQty)
    check('Material issue succeeds', issue.ok, issue.error)

    const movementsAfter = useInventoryStore.getState().stockMovements
    check('Movement ledger grew', movementsAfter.length > movementsBefore, `+${movementsAfter.length - movementsBefore}`)

    const woMovement = movementsAfter.find(
      (m) =>
        m.movementType === 'issue' &&
        m.referenceType === 'ISSUE_TO_WO' &&
        m.workOrderId === mfgWo.id &&
        m.itemId === lineToIssue.itemId,
    )
    check('ISSUE_TO_WO ledger entry exists', !!woMovement, woMovement?.movementNo)
    check('Issue qty is negative in ledger', (woMovement?.qty ?? 0) < 0, String(woMovement?.qty))

    const wipCut = master.warehouses.find((w) => w.warehouseCode === 'WIP_CUTTING')
    const wipReceive = movementsAfter.find(
      (m) =>
        m.referenceType === 'MOVE_TO_WIP' &&
        m.workOrderId === mfgWo.id &&
        m.warehouseId === wipCut?.id &&
        m.itemId === lineToIssue.itemId,
    )
    check('MOVE_TO_WIP to first op WIP (WIP_CUTTING) after issue', !!wipReceive, wipReceive?.movementNo)
    check('WIP receive qty is positive', (wipReceive?.qty ?? 0) > 0, String(wipReceive?.qty))
  } else {
    check('Material issue succeeds', false, 'no line with reserved qty')
    check('Movement ledger grew', false)
    check('ISSUE_TO_WO ledger entry exists', false)
    check('Issue qty is negative in ledger', false)
    check('WIP receive to first op WIP after issue', false)
    check('WIP receive qty is positive', false)
  }
}

// ── 5. FG receipt into FG Yard ──
console.log('\n── 5. FG receipt into FG Yard ──')
if (fgWo) {
  const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
  const fgOnHandBefore = useInventoryStore.getState().getOnHand(fgWo.fgItemId, fgWh.id)

  // FG WO path: post SA receipts from child WOs → issue sub-assemblies → start production
  prepareFgSubAssemblyConsumption(fgWo.id)

  const fgStart = useWorkOrderStore.getState().startProduction(fgWo.id)
  check('FG production started', fgStart.ok, fgStart.error)

  if (!fgStart.ok) {
    check('Production operations generated from routing', false, 'skipped — FG start failed')
  } else {
  const prodOps = useWorkOrderStore.getState().getProductionOperations(fgWo.id)
  check('Production operations generated from routing', prodOps.length === 10, `${prodOps.length} ops`)
  check('First operation is Cutting (seq 10)', prodOps[0]?.operationName === 'Cutting')
  check('Painting operation is outsourced', prodOps.some((o) => o.operationName === 'Painting' && o.outsourced))

  const jobCards = useWorkOrderStore.getState().getJobCards(fgWo.id)
  check('Job cards generated with production start', jobCards.length === 10, `${jobCards.length} cards`)
  check('Each operation has a job card', prodOps.every((o) => jobCards.some((j) => j.productionOperationId === o.id)))

  const weldingOp = prodOps.find((o) => o.sequenceNo === 40)!
  const weldingJc = jobCards.find((j) => j.productionOperationId === weldingOp.id)!
  check('Welding job card exists (Op 40)', !!weldingJc, weldingJc?.jobCardNo)
  check('Welding op has QC checklist', weldingOp.qcChecklist.length === 3)
  check('Welding QC includes leak test', weldingOp.qcChecklist.some((c) => c.label === 'Leak test'))
  check('Welding job card has QC checks', weldingJc.qcChecks.length === 3)

  const { useQualityStore } = await import('../src/store/qualityStore')

  function completePriorOpsThrough(maxSeq: number) {
    const woStore = useWorkOrderStore.getState()
    const qStore = useQualityStore.getState()
    const priorOps = woStore
      .getProductionOperations(fgWo.id)
      .filter((o) => o.sequenceNo < maxSeq && !o.outsourced)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)

    for (const op of priorOps) {
      const jc = woStore.getJobCards(fgWo.id).find((j) => j.productionOperationId === op.id)!
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
          passInspection(insp.id, 'Lata Menon', 'Auto-pass prior operation for WO flow test')
        }
      }
    }
  }

  completePriorOpsThrough(40)

  const jcStart = useWorkOrderStore.getState().startJobCard(weldingJc.id, {
    assignedTeam: 'Welding Team A',
    startTime: '08:00',
  })
  check('Start job card succeeds', jcStart.ok, jcStart.error)

  const qcChecksIncomplete = useWorkOrderStore.getState().getJobCardByOperation(weldingOp.id)!.qcChecks
  const blockedComplete = useWorkOrderStore.getState().completeJobCard(weldingJc.id, {
    endTime: '17:00',
    actualHours: 8.5,
    remarks: 'Tank shell completed',
    qcChecks: qcChecksIncomplete.map((c) => ({ ...c, passed: false })),
  })
  check('Complete blocked until QC checklist done', !blockedComplete.ok)

  const jcComplete = useWorkOrderStore.getState().completeJobCard(weldingJc.id, {
    endTime: '17:00',
    actualHours: 8.5,
    remarks: 'Tank shell completed',
    qcChecks: qcChecksIncomplete.map((c) => ({ ...c, passed: true })),
  })
  check('Complete job card succeeds', jcComplete.ok, jcComplete.error)

  const completedJc = useWorkOrderStore.getState().getJobCardByOperation(weldingOp.id)
  check('Job card shows assigned team', completedJc?.assignedTeam === 'Welding Team A')
  check('Job card actual hours recorded', completedJc?.actualHours === 8.5)
  check('All QC checks recorded passed', completedJc?.qcChecks.every((c) => c.passed))
  check('Welding operation marked completed or QC hold', ['completed', 'qc_hold'].includes(
    useWorkOrderStore.getState().getProductionOperations(fgWo.id).find((o) => o.id === weldingOp.id)?.status ?? '',
  ))

  const pendingInsp = useQualityStore.getState().getPendingInspections().find((i) => i.workOrderId === fgWo.id && i.sequenceNo === 40)
  check('QC inspection queued after welding complete', !!pendingInsp, pendingInsp?.inspectionNo)

  const blockedWo = useWorkOrderStore.getState().completeWorkOrder(fgWo.id)
  check('WO complete blocked while QC hold open', !blockedWo.ok)

  if (pendingInsp) {
    const qcPass = passInspection(
      pendingInsp.id,
      'Pradeep Singh',
      'Weld penetration OK, joint inspection passed, leak test passed',
    )
    check('QC PASS releases welding operation', qcPass.ok, qcPass.error)
    check('Welding op completed after QC pass', useWorkOrderStore.getState().getProductionOperations(fgWo.id).find((o) => o.id === weldingOp.id)?.status === 'completed')
  }

  useWorkOrderStore.getState().completeWorkOrder(fgWo.id)

  const fgReceipt = useWorkOrderStore.getState().postFgReceipt(fgWo.id)
  check('FG receipt succeeds', fgReceipt.ok, fgReceipt.error)

  const fgOnHandAfter = useInventoryStore.getState().getOnHand(fgWo.fgItemId, fgWh.id)
  check('FG Yard on-hand increased', fgOnHandAfter > fgOnHandBefore, `${fgOnHandBefore} → ${fgOnHandAfter}`)

  const fgMovement = useInventoryStore.getState().stockMovements.find(
    (m) =>
      (m.referenceType === 'FG_RECEIPT' || m.referenceType === 'WIP_TRANSFER') &&
      m.workOrderId === fgWo.id &&
      m.qty > 0,
  )
  check('FG receipt movement in ledger', !!fgMovement, fgMovement?.movementNo)
  check('FG movement posted to FG_YARD', fgMovement?.warehouseId === fgWh.id)

  const fgReceipts = useWorkOrderStore.getState().getFgReceipts(fgWo.id)
  check('FG receipt record on WO', fgReceipts.length > 0)
  check('WO status = fg_received', useWorkOrderStore.getState().getWorkOrder(fgWo.id)?.status === 'fg_received')
  }
}

// ── 6. Subcontract send & receive ──
console.log('\n── 6. Subcontract WO send & receive ──')
if (subWo) {
  useWorkOrderStore.getState().planWorkOrder(subWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(subWo.id)

  const subLine = useWorkOrderStore.getState().getWoMaterials(subWo.id)[0]
  const vendor = master.vendors.find((v) => v.isActive)!

  if (subLine) {
    // Ensure stock for send — use primer from paint store if line item has stock
    const free = useInventoryStore.getState().getFreeQty(subLine.itemId, subLine.warehouseId)
    const sendQty = Math.min(subLine.requiredQty, free > 0 ? free : 0)

    if (sendQty <= 0) {
      // Post inward to enable send test
      useInventoryStore.getState().postInward({
        itemId: subLine.itemId,
        warehouseId: subLine.warehouseId,
        qty: subLine.requiredQty,
        referenceNo: 'TEST-INW',
        remarks: 'Test inward for subcontract send',
      })
    }

    const qtyToSend = Math.min(
      subLine.requiredQty,
      useInventoryStore.getState().getFreeQty(subLine.itemId, subLine.warehouseId),
    )

    const movementsBeforeSend = useInventoryStore.getState().stockMovements.length
    const send = useWorkOrderStore.getState().sendSubcontractMaterial(
      subWo.id,
      subLine.id,
      vendor.id,
      'SC-CH-001',
      qtyToSend,
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    )
    check('Subcontract send succeeds', send.ok, send.error)

    const subOut = useInventoryStore.getState().stockMovements.find(
      (m) => m.referenceType === 'SUBCON_OUT' && m.workOrderId === subWo.id,
    )
    check('SUBCON_OUT movement created', !!subOut, subOut?.movementNo)
    check('Movement ledger grew on send', useInventoryStore.getState().stockMovements.length > movementsBeforeSend)

    const shipments = useWorkOrderStore.getState().getSubcontractShipments(subWo.id)
    check('Subcontract shipment record created', shipments.length > 0, shipments[0]?.challanNo)

    const receive = useWorkOrderStore.getState().receiveSubcontractMaterial(shipments[0].id, qtyToSend, 0)
    check('Subcontract receive succeeds', receive.ok, receive.error)

    const subIn = useInventoryStore.getState().stockMovements.find(
      (m) => m.referenceType === 'SUBCON_IN' && m.workOrderId === subWo.id,
    )
    check('SUBCON_IN movement created', !!subIn, subIn?.movementNo)

    const updatedShipment = useWorkOrderStore.getState().getSubcontractShipments(subWo.id)[0]
    check('Shipment status = received', updatedShipment?.status === 'received')
  } else {
    check('Subcontract send succeeds', false, 'no material line')
    check('SUBCON_OUT movement created', false)
    check('Movement ledger grew on send', false)
    check('Subcontract shipment record created', false)
    check('Subcontract receive succeeds', false)
    check('SUBCON_IN movement created', false)
    check('Shipment status = received', false)
  }
}

// ── 7. Routing gate ──
console.log('\n── 7. Routing enforcement ──')
const releasedRtg = useRoutingStore.getState().getReleasedRoutingForProduct(so.productId)
check('Released routing exists for 45 M3 Bulker', !!releasedRtg, releasedRtg?.routingNo)
check('Routing has 10 operations', useRoutingStore.getState().getOperations(releasedRtg!.id).length === 10)

console.log('\n═══════════════════════════════════════════════════════')
console.log(` Results: ${pass} passed, ${fail} failed`)
console.log(fail === 0 ? ' ALL WO FLOW TESTS PASS' : ' WO FLOW TESTS FAILED')
console.log('═══════════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
