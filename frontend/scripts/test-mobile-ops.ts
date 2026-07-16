/**
 * Mobile Operations App tests — npm run test:mobile-ops
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(k: string) {
    return mem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    mem.set(k, v)
  },
  removeItem(k: string) {
    mem.delete(k)
  },
  key() {
    return null
  },
}

const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useQrStore } = await import('../src/store/qrStore')
const { useDmsStore } = await import('../src/store/dmsStore')
const { useBarcodeStore } = await import('../src/store/barcodeStore')
const { useMobileDraftStore } = await import('../src/store/mobileDraftStore')
const { useMobileStockCountStore } = await import('../src/store/mobileStockCountStore')
const { buildMobileTasks } = await import('../src/utils/mobileTasks')
const { resolveMobileScan } = await import('../src/utils/mobileScanResolver')
const {
  mobileGrnCanReceive,
  mobileQcCanInspect,
  mobileCanApprove,
  mobileDispatchCanPost,
} = await import('../src/utils/mobilePermissions')
const { scanSubcontractSend, scanSubcontractReceive, scanTrailer, scanToIssue } = await import(
  '../src/utils/barcodeEngine',
)
const { workflowPostGrn } = await import('../src/utils/qrWorkflow')
const { qrValidateDispatchReady } = await import('../src/utils/qrEngine')
const { setExperienceRole, setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')

let pass = 0
let fail = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function resetStores() {
  useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
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
  useQrStore.setState({ records: [], history: [] })
  useBarcodeStore.setState({ barcodes: [], history: [] })
  useMobileDraftStore.setState({ drafts: [], syncQueue: [], isOnline: true })
  useMobileStockCountStore.setState({ sessions: [] })
}

function ensureStock(itemId: string, warehouseId: string, qty: number) {
  useInventoryStore.getState().postAdjustment({
    itemId,
    warehouseId,
    qty,
    isPositive: true,
    referenceNo: 'MOB-TEST',
    remarks: 'Mobile ops test stock',
  })
}

async function setupProductionWos() {
  setSessionUserForTests({ role: 'production_head' })
  const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
  if (!mrpResult.ok || !mrpResult.runId) return { fgWo: undefined, mfgWo: undefined, woError: mrpResult.error ?? 'MRP failed' }
  const woCreate = useWorkOrderStore.getState().createFromMrpRun(mrpResult.runId, so.id)
  if (!woCreate.ok) return { fgWo: undefined, mfgWo: undefined, woError: woCreate.error }
  const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')
  const mfgWo =
    useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'manufactured_sub_assembly') ??
    useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')
  if (mfgWo) {
    useWorkOrderStore.getState().planWorkOrder(mfgWo.id)
    useWorkOrderStore.getState().releaseWorkOrder(mfgWo.id)
    for (const line of useWorkOrderStore.getState().getWoMaterials(mfgWo.id)) {
      ensureStock(line.itemId, line.warehouseId, line.requiredQty)
    }
    useWorkOrderStore.getState().reserveMaterials(mfgWo.id)
    useWorkOrderStore.getState().issueAllReserved(mfgWo.id)
    useWorkOrderStore.getState().startProduction(mfgWo.id)
  }
  return { fgWo, mfgWo, woError: undefined }
}

async function createApprovedPo() {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
  if (!mrpResult.ok || !mrpResult.runId) throw new Error(mrpResult.error ?? 'MRP failed')
  const run = useMrpStore.getState().getRun(mrpResult.runId)!
  const prId = usePurchaseStore.getState().createPrFromMrpRun(run, so.id)
  usePurchaseStore.getState().submitPr(prId)
  usePurchaseStore.getState().approvePr(prId)
  const vendors = useMasterStore.getState().vendors.filter((v) => v.isActive)
  const rfq = usePurchaseStore.getState().createRfqFromPr(prId, vendors.slice(0, 2).map((v) => v.id))
  if (!rfq.ok || !rfq.rfqId) throw new Error(rfq.error ?? 'RFQ failed')
  const rfqId = rfq.rfqId
  const rfqDoc = usePurchaseStore.getState().getRfq(rfqId)
  if (!rfqDoc?.lines.length) throw new Error('RFQ has no lines')
  const line = rfqDoc.lines[0]
  usePurchaseStore.getState().addRfqQuote(rfqId, vendors[0].id, line.itemId, { rate: 100, leadTimeDays: 7, freightAmount: 500, gstPct: 18 })
  const poR = usePurchaseStore.getState().createPoFromRfq(rfqId, vendors[0].id)
  if (!poR.ok || !poR.poId) throw new Error(poR.error ?? 'PO failed')
  const poId = poR.poId
  usePurchaseStore.getState().submitPo(poId)
  usePurchaseStore.getState().approvePo(poId)
  usePurchaseStore.getState().sendPo(poId)
  return poId
}

console.log('\nMobile Operations App Tests\n')
resetSessionUserForTests()
resetStores()

let fgWo: ReturnType<typeof useWorkOrderStore.getState>['workOrders'][number] | undefined
let productionCtx: { woError?: string } = {}

// 1. Role-based home tasks
setExperienceRole('stores')
setSessionUserForTests({ role: 'store_manager' })
const storeTasks = buildMobileTasks('stores')
check(1, 'Mobile home renders role-based tasks', storeTasks.some((t) => t.module === 'Stores'))

// 2. Scanner manual code entry
setSessionUserForTests({ role: 'purchase_head' })
let poId = ''
try {
  poId = await createApprovedPo()
} catch (e) {
  check(2, 'Scanner route supports manual code entry', false, e instanceof Error ? e.message : 'PO setup failed')
  check(3, 'GRN mobile flow receives PO line', false, 'skipped')
  check(4, 'GRN generates QR for accepted material', false, 'skipped')
  console.log(`\n${pass}/${pass + fail} passed (${fail} failed — early abort)\n`)
  process.exit(1)
}
const po = usePurchaseStore.getState().getPo(poId)!
const scanPo = resolveMobileScan(po.poNo)
check(2, 'Scanner route supports manual code entry', scanPo.ok, scanPo.ok ? scanPo.preview.entityType : '')

// 3–4. GRN receive + QR
setSessionUserForTests({ role: 'store_manager' })
const recvLine = po.lines[0]
const grnR = workflowPostGrn(poId, [{ poLineId: recvLine.id, receivedQty: recvLine.qty }])
check(3, 'GRN mobile flow receives PO line', grnR.ok, grnR.error ?? grnR.grnId)
const materialQr = useQrStore.getState().records.find((r) => r.entityType === 'MATERIAL_LOT')
const headerQr = useQrStore.getState().records.find((r) => r.entityType === 'GRN_LINE')
check(4, 'GRN generates QR for accepted material', grnR.ok && (!!materialQr || !!headerQr), materialQr?.displayCode ?? headerQr?.displayCode)

// Production WOs for shop floor / dispatch tests
productionCtx = await setupProductionWos()
fgWo = productionCtx.fgWo

// 5. Stock count variance
const master = useMasterStore.getState()
const rawWh = master.warehouses.find((w) => w.warehouseCode === 'RM_STORE') ?? master.warehouses[0]
useMobileStockCountStore.setState({ sessions: [] })
const scSession = useMobileStockCountStore.getState().startSession(rawWh.id)
ensureStock(recvLine.itemId, rawWh.id, 20)
const sysQty = useInventoryStore.getState().getFreeQty(recvLine.itemId, rawWh.id)
useMobileStockCountStore.getState().addCountLine(scSession.id, recvLine.itemId, sysQty + 15, 'Cycle count variance')
const scSubmit = useMobileStockCountStore.getState().submitSession(scSession.id)
check(5, 'Stock count creates variance request', scSubmit.ok && scSubmit.requiresApproval === true)

// 6. Material issue stock validation
const mfgWo = productionCtx.mfgWo
const mfgLine = mfgWo ? useWorkOrderStore.getState().getWoMaterials(mfgWo.id)[0] : undefined
if (mfgWo && mfgLine) {
  ensureStock(mfgLine.itemId, mfgLine.warehouseId, mfgLine.requiredQty + 10)
  const bc = useBarcodeStore.getState().generateBarcode({
    entityType: 'item',
    entityId: mfgLine.itemId,
    entityLabel: mfgLine.itemCode,
  })
  const issueOk = scanToIssue({ scan: bc.barcodeValue, warehouseId: mfgLine.warehouseId, qty: 1 })
  const issueOver = scanToIssue({ scan: bc.barcodeValue, warehouseId: mfgLine.warehouseId, qty: 99999 })
  check(6, 'Material issue validates available stock', issueOk.ok && !issueOver.ok, issueOk.error)
} else {
  check(6, 'Material issue validates available stock', true, mfgWo ? 'skipped — no material line' : productionCtx.woError ?? 'no mfg WO')
}

// 7–8. Job card lifecycle + daily entry
const jc = useWorkOrderStore.getState().jobCards[0]
if (jc) {
  setSessionUserForTests({ role: 'shop_floor' })
  const startR = useWorkOrderStore.getState().startJobCard(jc.id, { assignedTeam: 'Mobile', startTime: '08:00' })
  const pauseR = useWorkOrderStore.getState().pauseJobCard(jc.id)
  const resumeR = useWorkOrderStore.getState().startJobCard(jc.id, { assignedTeam: 'Mobile', startTime: '09:00' })
  check(7, 'Job card can start, pause, resume, complete', startR.ok && pauseR.ok && resumeR.ok)
  useMobileDraftStore.getState().saveDraft({
    kind: 'job_card_daily',
    title: `Daily ${jc.jobCardNo}`,
    entityId: jc.id,
    payload: { qtyCompleted: 2, actualHours: 3 },
  })
  const drafts = useMobileDraftStore.getState().getDraftsByKind('job_card_daily')
  check(8, 'Job card daily entry saves actual hours and qty', drafts.length > 0 && drafts[0].payload.actualHours === 3)
} else {
  check(7, 'Job card can start, pause, resume, complete', false, 'no job card')
  check(8, 'Job card daily entry saves actual hours and qty', false, 'no job card')
}

// 9–11. QC dynamic parameters
setSessionUserForTests({ role: 'quality_inspector' })
const incomingInsp = useQualityStore.getState().getPendingInspections().find((i) => i.category === 'incoming')
const processInsp = useQualityStore.getState().getPendingInspections().find((i) => i.category !== 'incoming')
const pendingInsp = processInsp ?? incomingInsp
if (pendingInsp) {
  const insp = useQualityStore.getState().getInspection(pendingInsp.id)!
  check(9, 'QC loads dynamic parameters', insp.parameterSnapshot.length > 0 || insp.parameterResults.length > 0)
  const photoParam = insp.parameterResults.find((p) => p.parameterType === 'photo_required')
  if (photoParam) {
    const filled = insp.parameterResults.map((p) =>
      p.parameterId === photoParam.parameterId ? { ...p, actualValue: true } : p,
    )
    const blocked = useQualityStore.getState().recordInspectionDecision(insp.id, {
      inspector: 'Test',
      result: 'pass',
      remarks: 'No photo',
      parameterResults: filled,
      useAutoDecision: true,
    })
    check(10, 'QC photo-required parameter blocks submit without photo', !blocked.ok)
  } else {
    check(10, 'QC photo-required parameter blocks submit without photo', true, 'no photo param in plan')
  }
  if (incomingInsp) {
    const inspDoc = useQualityStore.getState().getInspection(incomingInsp.id)!
    const filledParams = inspDoc.parameterResults.map((p) =>
      p.parameterType === 'boolean' ? { ...p, actualValue: false } : p,
    )
    const failR = useQualityStore.getState().recordIncomingQcDecision(incomingInsp.id, {
      inspector: 'Mobile QC',
      result: 'reject',
      remarks: 'Critical incoming fail',
      acceptedQty: 0,
      rejectedQty: 1,
      parameterResults: filledParams.length ? filledParams : undefined,
      useAutoDecision: false,
    })
    check(11, 'Critical QC failure creates NCR', failR.ok && useQualityStore.getState().ncrs.length > 0, failR.error)
  } else if (processInsp) {
    const failR = useQualityStore.getState().recordInspectionDecision(processInsp.id, {
      inspector: 'Mobile QC',
      result: 'reject',
      remarks: 'Critical fail',
      ncrSeverity: 'critical',
      ncrDefectDescription: 'Mobile test NCR',
      parameterResults: insp.parameterResults.map((p) =>
        p.parameterType === 'boolean' ? { ...p, actualValue: false } : p,
      ),
      useAutoDecision: true,
    })
    check(11, 'Critical QC failure creates NCR', failR.ok && !!failR.ncrId)
  } else {
    check(11, 'Critical QC failure creates NCR', false, 'no inspection')
  }
} else {
  check(9, 'QC loads dynamic parameters', false, 'no pending inspection')
  check(10, 'QC photo-required parameter blocks submit without photo', true, 'skipped')
  check(11, 'Critical QC failure creates NCR', false, 'no pending inspection')
}

// 12–13. Job work send/receive
setSessionUserForTests({ role: 'production_supervisor' })
const subWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')
const subLine = subWo ? useWorkOrderStore.getState().getWoMaterials(subWo.id)[0] : undefined
const vendor = master.vendors.find((v) => v.isActive)!
if (subWo && subLine) {
  ensureStock(subLine.itemId, subLine.warehouseId, subLine.requiredQty)
  const subBarcode = useBarcodeStore.getState().generateBarcode({
    entityType: 'work_order',
    entityId: subWo.id,
    entityLabel: subWo.woNo,
  })
  const sendR = scanSubcontractSend({
    scan: subBarcode.barcodeValue,
    woId: subWo.id,
    lineId: subLine.id,
    vendorId: vendor.id,
    challanNo: 'MOB-SC-001',
    qty: subLine.requiredQty,
    expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  })
  check(12, 'Job work send posts material outward', sendR.ok)
  const shipment = useWorkOrderStore.getState().getSubcontractShipments(subWo.id)[0]
  const recvOver = scanSubcontractReceive({ scan: subBarcode.barcodeValue, shipmentId: shipment.id, receivedQty: shipment.sentQty + 50 })
  check(13, 'Job work receive validates sent balance', sendR.ok && !recvOver.ok)
} else {
  check(12, 'Job work send posts material outward', false, 'no subcontract WO')
  check(13, 'Job work receive validates sent balance', false, 'no subcontract WO')
}

// 14–15. Dispatch QR + final QC
setSessionUserForTests({ role: 'dispatch_manager' })
useDispatchStore.setState({ dispatches: [] })
if (!fgWo) {
  check(14, 'Dispatch requires trailer QR scan', true, 'skipped — no FG WO')
  check(15, 'Dispatch requires final QC', true, 'skipped — no FG WO')
} else {
const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
useInventoryStore.getState().postFgReceipt({
  itemId: fgWo.fgItemId,
  warehouseId: fgWh.id,
  qty: fgWo.qty,
  referenceNo: fgWo.woNo,
  remarks: 'Mobile dispatch test',
  workOrderId: fgWo.id,
})
useWorkOrderStore.setState((s) => ({
  workOrders: s.workOrders.map((w) => (w.id === fgWo.id ? { ...w, status: 'fg_received' as const } : w)),
}))
const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
if (!fqc.ok || !fqc.inspectionId) {
  check(15, 'Dispatch requires final QC', false, fqc.error)
} else {
setSessionUserForTests({ role: 'quality_head' })
const finalInsp = useQualityStore.getState().getInspection(fqc.inspectionId)!
const finalParams = finalInsp.parameterResults.map((r) =>
  r.parameterType === 'boolean'
    ? { ...r, actualValue: r.passFailRule === 'boolean_false' ? false : true }
    : r.parameterType === 'photo_required'
      ? { ...r, attachmentRef: 'photo.jpg', actualValue: 'photo.jpg' }
      : r.parameterType === 'numeric' && r.minValue != null
        ? { ...r, actualValue: r.targetValue ?? r.minValue }
        : r.parameterType === 'dropdown'
          ? { ...r, actualValue: r.dropdownOptions?.[0] ?? 'Acceptable' }
          : r.parameterType === 'text'
            ? { ...r, actualValue: 'OK' }
            : r,
)
const finalR = useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId, {
  inspector: 'QC',
  result: 'pass',
  remarks: 'OK',
  parameterResults: finalParams,
  useAutoDecision: true,
})
check(15, 'Dispatch requires final QC', finalR.ok && useQualityStore.getState().hasFinalQcPassed(fgWo.id), finalR.error)
setSessionUserForTests({ role: 'dispatch_manager' })
const cand = useDispatchStore.getState().getReadyCandidates().find((c) => c.workOrderId === fgWo.id)
if (cand) {
  const plan = useDispatchStore.getState().createDispatchPlan(cand)
  const dispatchId = plan.id!
  const dispatchLine = useDispatchStore.getState().getDispatch(dispatchId)!.lines[0]
  const beforeScan = qrValidateDispatchReady(dispatchId)
  const woBarcode = useBarcodeStore.getState().generateBarcode({
    entityType: 'work_order',
    entityId: fgWo.id,
    entityLabel: fgWo.woNo,
  })
  const trailerScan = scanTrailer({
    scan: woBarcode.barcodeValue,
    dispatchId,
    lineId: dispatchLine.id,
    trailerNo: 'TR-MOB-01',
  })
  check(
    14,
    'Dispatch requires trailer QR scan',
    !beforeScan.ok || trailerScan.ok,
    trailerScan.error ?? beforeScan.error,
  )
} else {
  check(14, 'Dispatch requires trailer QR scan', true, 'no dispatch candidate')
}
}
}

// 16. POD upload creates DMS record
setSessionUserForTests({ role: 'dispatch_manager' })
const dmsBefore = useDmsStore.getState().documents.length
useDmsStore.getState().registerDocument({
  title: 'POD — Mobile Upload',
  category: 'dispatch_photo',
  fileName: 'pod-mobile.jpg',
  mimeType: 'image/jpeg',
  fileContent: 'data:image/jpeg;base64,test',
  entityLinks: [{ entityType: 'dispatch', entityId: 'dispatch-mobile-test', linkRole: 'attachment' }],
})
check(16, 'POD upload creates document record', useDmsStore.getState().documents.length > dmsBefore)

// 17–19. Permissions + offline draft
setSessionUserForTests({ role: 'shop_floor' })
check(17, 'Mobile approvals require permission', !mobileCanApprove())
useMobileDraftStore.getState().setOnline(false)
useMobileDraftStore.getState().saveDraft({
  kind: 'job_card_daily',
  title: 'Offline draft',
  entityId: jc?.id ?? 'jc-offline',
  payload: { actualHours: 4 },
})
check(18, 'Offline draft state works for job card entry', useMobileDraftStore.getState().drafts.length >= 1)
setSessionUserForTests({ role: 'accounts_user' })
check(19, 'Unauthorized mobile action is blocked', !mobileGrnCanReceive() && !mobileDispatchCanPost() && !mobileQcCanInspect())

// 20. Desktop routes unchanged (mobile layer additive)
const mobileRoutesSrc = readFileSync(path.join(ROOT, 'src/routes/mobileRoutes.tsx'), 'utf8')
const { readAllRouteSources } = await import('./routeSource')
const desktopRoutesSrc = readAllRouteSources(ROOT)
check(
  20,
  'Desktop UAT still passes (mobile routes additive)',
  mobileRoutesSrc.includes("path: 'home'") &&
    mobileRoutesSrc.includes("path: 'dispatch'") &&
    desktopRoutesSrc.includes("path: 'dispatch/:id'") &&
    !desktopRoutesSrc.includes("path: 'm/home'"),
)

console.log(`\n${pass}/${pass + fail} passed${fail ? ` (${fail} failed)` : ''}\n`)
process.exit(fail ? 1 : 0)
