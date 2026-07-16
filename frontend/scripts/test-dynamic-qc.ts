/**
 * Dynamic QC integration tests — npm run test:dynamic-qc
 * Sprint 2 — 12 test cases
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

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { DEMO_WO_ANCHORS } = await import('../src/data/production/woAnchors')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const {
  resolveDynamicInspectionPlan,
  buildParameterSnapshot,
  buildEmptyParameterResults,
} = await import('../src/utils/qcPlanResolver')
const { validateQcSubmission } = await import('../src/utils/qcDecisionEngine')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
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
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
}

function fillBooleanParams(results: ReturnType<typeof buildEmptyParameterResults>, pass = true) {
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

function ensureTankWoMaterials(tankWoId: string) {
  for (const line of useWorkOrderStore.getState().getWoMaterials(tankWoId)) {
    const free = useInventoryStore.getState().getFreeQty(line.itemId, line.warehouseId)
    if (free < line.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.requiredQty - free + 10,
        referenceNo: 'TEST-DQC-INW',
        remarks: 'Test inward for dynamic QC',
      })
    }
  }
}

function completePriorOpsThrough(woId: string, maxSeq: number) {
  const woStore = useWorkOrderStore.getState()
  const qStore = useQualityStore.getState()
  for (const op of woStore.getProductionOperations(woId).filter((o) => o.sequenceNo < maxSeq && !o.outsourced).sort((a, b) => a.sequenceNo - b.sequenceNo)) {
    const jc = woStore.getJobCards(woId).find((j) => j.productionOperationId === op.id)!
    woStore.startJobCard(jc.id, { assignedTeam: 'Setup Crew', startTime: '07:00' })
    woStore.completeJobCard(jc.id, {
      endTime: '11:00',
      actualHours: 3,
      remarks: 'Prior op complete',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qStore.getPendingInspections().find((i) => i.productionOperationId === op.id)
      if (insp?.parameterResults.length) {
        qStore.recordInspectionDecision(insp.id, {
          inspector: 'QC Inspector A',
          result: 'pass',
          remarks: 'Auto-pass',
          parameterResults: fillBooleanParams(insp.parameterResults, true),
          useAutoDecision: true,
        })
      } else if (insp) {
        qStore.recordInspectionDecision(insp.id, { inspector: 'QC Inspector A', result: 'pass', remarks: 'Auto-pass' })
      }
    }
  }
}

function setupWeldingInspection() {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === DEMO_WO_ANCHORS.salesOrderNo)!
  useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
  useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, so.id)
  const tankWo =
    useWorkOrderStore.getState().workOrders.find((w) => w.woNo === DEMO_WO_ANCHORS.tankAssemblyWoNo) ??
    useWorkOrderStore.getState().workOrders.find((w) => w.outputItemCode === DEMO_WO_ANCHORS.tankOutputItemCode)!
  useWorkOrderStore.getState().planWorkOrder(tankWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(tankWo.id)
  ensureTankWoMaterials(tankWo.id)
  useWorkOrderStore.getState().reserveMaterials(tankWo.id)
  useWorkOrderStore.getState().issueAllReserved(tankWo.id)
  useWorkOrderStore.getState().startProduction(tankWo.id)
  completePriorOpsThrough(tankWo.id, DEMO_WO_ANCHORS.weldingSequenceNo)
  const weldingJc = useWorkOrderStore.getState().getJobCards(tankWo.id).find((j) => j.sequenceNo === DEMO_WO_ANCHORS.weldingSequenceNo)!
  useWorkOrderStore.getState().startJobCard(weldingJc.id, { assignedTeam: 'Welding Team A', startTime: '08:00' })
  useWorkOrderStore.getState().completeJobCard(weldingJc.id, {
    endTime: '17:00',
    actualHours: 8,
    remarks: 'Welding complete',
    qcChecks: weldingJc.qcChecks.map((c) => ({ ...c, passed: true })),
  })
  return useQualityStore.getState().inspections.find((i) => i.productionOperationId === weldingJc.productionOperationId)
}

reset()

// 1. Welding operation loads welding QC parameters
const weldPlan = resolveDynamicInspectionPlan({
  category: 'in_process',
  productId: 'prod-45m3',
  operationName: 'Welding',
  workCenterId: 'wc-welding',
})
const weldParams = weldPlan ? buildParameterSnapshot(weldPlan).map((p) => p.parameterCode) : []
check(
  1,
  'Welding operation loads welding QC parameters',
  weldPlan?.id === 'plan-welding-bulker' &&
    weldParams.includes('WELD-BEAD') &&
    weldParams.includes('WELD-POROSITY') &&
    weldParams.includes('WELD-PHOTO'),
  `${weldParams.length} params`,
)

// 2. Painting operation loads painting QC parameters
const paintPlan = resolveDynamicInspectionPlan({
  category: 'in_process',
  productId: 'prod-45m3',
  operationName: 'Painting',
  workCenterId: 'wc-paint',
})
const paintCodes = paintPlan ? buildParameterSnapshot(paintPlan).map((p) => p.parameterCode) : []
check(
  2,
  'Painting operation loads painting QC parameters',
  paintPlan?.id === 'plan-painting-bulker' &&
    paintCodes.includes('PAINT-DFT') &&
    paintCodes.includes('PAINT-SHADE'),
  paintCodes.join(', '),
)

// 3. Pressure test loads pressure test parameters
const testPlan = resolveDynamicInspectionPlan({
  category: 'in_process',
  productId: 'prod-45m3',
  operationName: 'Testing',
  workCenterId: 'wc-test',
})
const testCodes = testPlan ? buildParameterSnapshot(testPlan).map((p) => p.parameterCode) : []
check(
  3,
  'Pressure test loads pressure test parameters',
  testPlan?.id === 'plan-pressure-test' &&
    testCodes.includes('TEST-PRESSURE') &&
    testCodes.includes('TEST-LEAK'),
  testCodes.join(', '),
)

// 4. Incoming axle QC loads axle inspection plan
const axlePlan = resolveDynamicInspectionPlan({ category: 'incoming', itemId: 'item-bo-axl' })
const axleCodes = axlePlan ? buildParameterSnapshot(axlePlan).map((p) => p.parameterCode) : []
check(
  4,
  'Incoming axle QC loads axle inspection plan',
  axlePlan?.id === 'plan-incoming-axle' &&
    axleCodes.includes('AXL-MODEL') &&
    axleCodes.includes('AXL-CERT'),
  axleCodes.join(', '),
)

// 5. Subcontract return loads subcontract QC plan
const subPlan = resolveDynamicInspectionPlan({ category: 'subcontract_return' })
const subCodes = subPlan ? buildParameterSnapshot(subPlan).map((p) => p.parameterCode) : []
check(
  5,
  'Subcontract return loads subcontract QC plan',
  subPlan?.id === 'plan-subcontract-return' &&
    subCodes.includes('SUB-PROC-COMPLETE') &&
    subCodes.includes('SUB-DAMAGE'),
  subCodes.join(', '),
)

// 6. Mandatory missing value blocks submission
const emptyWeld = weldPlan ? buildEmptyParameterResults(buildParameterSnapshot(weldPlan)) : []
check(
  6,
  'Mandatory missing value blocks submission',
  !validateQcSubmission(emptyWeld).ok,
  validateQcSubmission(emptyWeld).errors[0],
)

// 7. Numeric tolerance outside range auto-fails
const paintResults = paintPlan
  ? fillBooleanParams(buildEmptyParameterResults(buildParameterSnapshot(paintPlan)), true)
  : []
const dftFail = paintResults.map((r) =>
  r.parameterCode === 'PAINT-DFT' ? { ...r, actualValue: 150 } : r,
)
const paintValidation = validateQcSubmission(dftFail)
check(
  7,
  'Numeric tolerance outside range auto-fails',
  paintValidation.autoDecision === 'reject' &&
    paintValidation.failedParameters.some((p) => p.parameterCode === 'PAINT-DFT'),
  `decision ${paintValidation.autoDecision}`,
)

// 8. Critical failure creates NCR
reset()
const weldInsp = setupWeldingInspection()
if (weldInsp?.parameterResults.length) {
  const criticalFail = weldInsp.parameterResults.map((r) =>
    r.parameterCode === 'WELD-POROSITY'
      ? { ...r, actualValue: false }
      : fillBooleanParams([r], true)[0],
  )
  const reject = useQualityStore.getState().recordInspectionDecision(weldInsp.id, {
    inspector: 'QC Inspector A',
    result: 'reject',
    remarks: 'Porosity fail',
    parameterResults: criticalFail,
    useAutoDecision: true,
  })
  check(
    8,
    'Critical failure creates NCR',
    reject.ok && !!reject.ncrId && useQualityStore.getState().ncrs.some((n) => n.id === reject.ncrId),
    reject.ncrId,
  )
} else {
  check(8, 'Critical failure creates NCR', false, 'Welding inspection not created')
}

// 9. Major failure creates Rework (manual decision)
reset()
const weldInspMajor = setupWeldingInspection()
if (weldInspMajor?.parameterResults.length) {
  const majorFail = weldInspMajor.parameterResults.map((r) =>
    r.parameterCode === 'WELD-BEAD'
      ? { ...r, actualValue: false }
      : fillBooleanParams([r], true)[0],
  )
  const rework = useQualityStore.getState().recordInspectionDecision(weldInspMajor.id, {
    inspector: 'QC Inspector A',
    result: 'rework',
    remarks: 'Weld bead touch-up',
    parameterResults: majorFail,
    useAutoDecision: false,
    reworkEstimatedHours: 3,
  })
  check(
    9,
    'Major failure creates Rework',
    rework.ok && !!rework.reworkId,
    rework.reworkId,
  )
} else {
  check(9, 'Major failure creates Rework', false, 'Welding inspection not created')
}

// 10. All mandatory pass marks inspection PASS
const weldPassResults = weldPlan ? fillBooleanParams(buildEmptyParameterResults(buildParameterSnapshot(weldPlan)), true) : []
const passValidation = validateQcSubmission(weldPassResults)
check(
  10,
  'All mandatory pass marks inspection PASS',
  passValidation.ok && passValidation.autoDecision === 'pass',
  passValidation.autoDecision ?? 'null',
)

// 11. Final QC cannot pass without inspection plan
reset()
const soFinal = seedSalesOrders.find((s) => s.salesOrderNo === DEMO_WO_ANCHORS.salesOrderNo)!
useMrpStore.getState().runMrpForOrder(soFinal.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(useMrpStore.getState().runs[0]!.id, soFinal.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')
if (fgWo) {
  const noPlanInsp: import('../src/types/quality').QcInspection = {
    id: 'qci-test-no-plan',
    inspectionNo: 'QCI-TEST-NOPLAN',
    category: 'final',
    workOrderId: fgWo.id,
    woNo: fgWo.woNo,
    grnId: null,
    grnNo: null,
    poId: null,
    productionOperationId: null,
    operationName: 'Final FG QC',
    sequenceNo: 999,
    jobCardId: null,
    vendorId: null,
    subcontractShipmentId: null,
    itemId: fgWo.outputItemId,
    itemCode: fgWo.outputItemCode,
    inspectionType: 'Final QC',
    inspector: null,
    inspectionDate: null,
    status: 'pending',
    result: null,
    remarks: '',
    checklistSnapshot: [],
    parameterSnapshot: [],
    parameterResults: [],
    acceptedQty: null,
    rejectedQty: null,
    quarantineQty: null,
    reworkOrderId: null,
    ncrId: null,
    isReinspection: false,
    sourceReworkId: null,
    planId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test',
    createdByName: 'Test',
  }
  useQualityStore.setState({ inspections: [noPlanInsp] })
  const blocked = useQualityStore.getState().recordFinalQcDecision(noPlanInsp.id, {
    inspector: 'QC Inspector A',
    result: 'pass',
    remarks: 'Attempt pass',
  })
  check(
    11,
    'Final QC cannot pass without inspection plan',
    !blocked.ok && blocked.error?.includes('Inspection plan required'),
    blocked.error,
  )
} else {
  check(11, 'Final QC cannot pass without inspection plan', false, 'FG WO not found')
}

// 12. Reinspection works after rework
reset()
const weldInsp2 = setupWeldingInspection()
if (weldInsp2?.parameterResults.length) {
  const allPass = fillBooleanParams(weldInsp2.parameterResults, true)
  const rework = useQualityStore.getState().recordInspectionDecision(weldInsp2.id, {
    inspector: 'QC Inspector A',
    result: 'rework',
    remarks: 'Minor touch-up required',
    parameterResults: allPass,
    useAutoDecision: false,
    reworkEstimatedHours: 2,
  })
  const reworkOrder = rework.reworkId ? useQualityStore.getState().getRework(rework.reworkId) : undefined
  if (reworkOrder) {
    useQualityStore.getState().startRework(reworkOrder.id, { assignedTeam: 'Welding Team A' })
    useQualityStore.getState().completeRework(reworkOrder.id, { actualHours: 1.5, remarks: 'Photo retaken' })
  }
  const reinspection = useQualityStore.getState().inspections.find((i) => i.isReinspection)
  check(
    12,
    'Reinspection works after rework',
    rework.ok &&
      !!rework.reworkId &&
      !!reinspection &&
      reinspection.parameterResults.length > 0 &&
      reinspection.parameterResults.some((p) => p.parameterCode === 'WELD-BEAD'),
    reinspection?.inspectionNo,
  )
} else {
  check(12, 'Reinspection works after rework', false, 'Welding inspection not created')
}

console.log(`\nDynamic QC: ${passed}/${passed + failed} passed${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
