/**
 * Execution layer integration test — npm run test:execution-layer
 */
import { seedSalesOrders } from '../src/data/mrp/seed'
import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'

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
const { useQualityStore } = await import('../src/store/qualityStore')
const { useJobWorkExecutionStore } = await import('../src/store/jobWorkExecutionStore')
const { listJobWorkOrdersFromState } = await import('../src/utils/jobWorkAdapter')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

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
  useJobWorkExecutionStore.setState({ metaByWoId: {} })
}

function ensureLineStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'EXEC-TEST-INW',
      remarks: 'Execution layer test inward',
    })
  }
}

function prepareFgForProduction(fgWoId: string) {
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

console.log('═══════════════════════════════════════════════════════')
console.log(' EXECUTION LAYER TESTS')
console.log('═══════════════════════════════════════════════════════')

resetStores()
const master = useMasterStore.getState()
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!

const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
check('MRP run completes', mrpResult.ok, mrpResult.error)
const runId = mrpResult.runId!
const run = useMrpStore.getState().getRun(runId)

const woCreate = useWorkOrderStore.getState().createFromMrpRun(runId, so.id)
check('WO creation from MRP', woCreate.ok, woCreate.error)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')
const subWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')

// ── 1. WO 360 linked data ──
console.log('\n── 1. Work Order 360 metrics ──')
if (fgWo) {
  prepareFgForProduction(fgWo.id)
  const fgStart = useWorkOrderStore.getState().startProduction(fgWo.id)
  check('FG production started for 360', fgStart.ok, fgStart.error)

  const wo360 = useWorkOrderStore.getState().getWorkOrder(fgWo.id)
  const mats = useWorkOrderStore.getState().getWoMaterials(fgWo.id)
  const ops = useWorkOrderStore.getState().getProductionOperations(fgWo.id)
  const cards = useWorkOrderStore.getState().getJobCards(fgWo.id)

  check('WO 360 — WO exists', !!wo360, wo360?.woNo)
  check('WO 360 — linked SO', wo360?.salesOrderNo === so.salesOrderNo)
  check('WO 360 — material lines', mats.length > 0, `${mats.length} lines`)
  check('WO 360 — operations from routing', ops.length > 0, `${ops.length} ops`)
  check('WO 360 — job cards generated', cards.length > 0, `${cards.length} cards`)
} else {
  check('WO 360 — FG WO exists', false)
  check('WO 360 — linked SO', false)
  check('WO 360 — material lines', false)
  check('WO 360 — operations', false)
  check('WO 360 — job cards', false)
}

// ── 2. Job card workbench data ──
console.log('\n── 2. Job Card Workbench ──')
const allCards = useWorkOrderStore.getState().jobCards
check('Job cards exist from WOs', allCards.length > 0, `${allCards.length} cards`)
check('Job cards linked to WO', allCards.length === 0 || allCards.every((j) => useWorkOrderStore.getState().getWorkOrder(j.workOrderId)))

// ── 3. Subcontract WO in JWO register ──
console.log('\n── 3. Job Work Register adapter ──')
const jwos = listJobWorkOrdersFromState()
check('Subcontract WO appears as JWO', jwos.some((j) => j.workOrderId === subWo?.id), subWo?.woNo)
if (subWo) {
  const jwo = jwos.find((j) => j.workOrderId === subWo.id)!
  check('JWO number format', jwo.jwoNo.startsWith('JWO-'), jwo.jwoNo)
}

// ── 4. Send material outbound ──
console.log('\n── 4. Send material movement ──')
if (subWo) {
  useWorkOrderStore.getState().planWorkOrder(subWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(subWo.id)
  const subLine = useWorkOrderStore.getState().getWoMaterials(subWo.id)[0]
  const vendor = master.vendors.find((v) => v.isActive)!

  if (subLine) {
    const free = useInventoryStore.getState().getFreeQty(subLine.itemId, subLine.warehouseId)
    if (free < subLine.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: subLine.itemId,
        warehouseId: subLine.warehouseId,
        qty: subLine.requiredQty,
        referenceNo: 'EXEC-TEST-INW',
        remarks: 'Execution layer test inward',
      })
    }

    const movBefore = useInventoryStore.getState().stockMovements.length
    const send = useJobWorkExecutionStore.getState().sendJobWorkMaterial({
      woId: subWo.id,
      lineId: subLine.id,
      vendorId: vendor.id,
      challanNo: 'EXEC-CH-001',
      qty: subLine.requiredQty,
      expectedReturnDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      vehicleNo: 'MH-01-AB-1234',
      driver: 'Test Driver',
    })
    check('Send material succeeds', send.ok, send.error)

    const subOut = useInventoryStore.getState().stockMovements.find(
      (m) => m.referenceType === 'SUBCON_OUT' && m.workOrderId === subWo.id,
    )
    check('Outbound SUBCON_OUT movement', !!subOut, subOut?.movementNo)
    check('Movement ledger grew', useInventoryStore.getState().stockMovements.length > movBefore)

    const shipment = useWorkOrderStore.getState().getSubcontractShipments(subWo.id)[0]
    check('Shipment has vehicle metadata', shipment?.vehicleNo === 'MH-01-AB-1234')

    // ── 5. Receive inbound ──
    console.log('\n── 5. Receive material movement ──')
    const recv = useJobWorkExecutionStore.getState().receiveJobWorkMaterial({
      shipmentId: shipment.id,
      acceptedQty: subLine.requiredQty,
      rejectedQty: 0,
      reworkQty: 0,
      qcRequired: false,
    })
    check('Receive material succeeds', recv.ok, recv.error)
    const subIn = useInventoryStore.getState().stockMovements.find(
      (m) => m.referenceType === 'SUBCON_IN' && m.workOrderId === subWo.id,
    )
    check('Inbound SUBCON_IN movement', !!subIn, subIn?.movementNo)

    // ── 6. Rejected receipt creates NCR ──
    console.log('\n── 6. Rejected subcontract NCR ──')
    resetStores()
    const mrp2 = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
    const run2Id = mrp2.runId!
    useWorkOrderStore.getState().createFromMrpRun(run2Id, so.id)
    const subWo2 = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'subcontract')!
    useWorkOrderStore.getState().planWorkOrder(subWo2.id)
    useWorkOrderStore.getState().releaseWorkOrder(subWo2.id)
    const line2 = useWorkOrderStore.getState().getWoMaterials(subWo2.id)[0]
    useInventoryStore.getState().postInward({
      itemId: line2.itemId,
      warehouseId: line2.warehouseId,
      qty: line2.requiredQty,
      referenceNo: 'EXEC-REJ-INW',
      remarks: 'Reject test inward',
    })
    useJobWorkExecutionStore.getState().sendJobWorkMaterial({
      woId: subWo2.id,
      lineId: line2.id,
      vendorId: vendor.id,
      challanNo: 'EXEC-CH-REJ',
      qty: line2.requiredQty,
      expectedReturnDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    })
    const ship2 = useWorkOrderStore.getState().getSubcontractShipments(subWo2.id)[0]
    const ncrBefore = useQualityStore.getState().ncrs.length
    const rejectRecv = useJobWorkExecutionStore.getState().receiveJobWorkMaterial({
      shipmentId: ship2.id,
      acceptedQty: 0,
      rejectedQty: 2,
      reworkQty: 0,
      qcRequired: false,
      remarks: 'Surface defect on return',
    })
    check('Reject receive succeeds', rejectRecv.ok, rejectRecv.error)
    check('NCR created on reject', useQualityStore.getState().ncrs.length > ncrBefore)
    const ncr = useQualityStore.getState().ncrs.find((n) => n.subcontractShipmentId === ship2.id)
    check('NCR linked to vendor', ncr?.vendorId === vendor.id)
    check('NCR linked to JWO/WO', ncr?.workOrderId === subWo2.id)
    check('NCR source is subcontract_return', ncr?.source === 'subcontract_return')

    // ── 7. Vendor 360 job work metrics ──
    console.log('\n── 7. Vendor job work metrics ──')
    const { listJobWorkOrdersFromState: listJwos } = await import('../src/utils/jobWorkAdapter')
    const vendorJwos = listJwos().filter((j) => j.vendorId === vendor.id)
    check('Vendor has JWO records', vendorJwos.length > 0, `${vendorJwos.length} JWO`)
    check('Vendor rejection tracked', vendorJwos.some((j) => j.rejectedQty > 0) || ncr != null)

    // ── 8. Cannot close with balance ──
    console.log('\n── 8. JWO close with pending balance ──')
    const subWo3 = subWo2
    const closeBlocked = useJobWorkExecutionStore.getState().closeJobWork(subWo3.id)
    check('Close blocked with pending balance', !closeBlocked.ok, closeBlocked.error)

    // ── 9. Print route data ──
    console.log('\n── 9. JWO print challan data ──')
    const printShipments = useWorkOrderStore.getState().getSubcontractShipments(subWo3.id)
    check('Print route has challan data', printShipments.some((s) => s.challanNo === 'EXEC-CH-REJ'))
    check('JWO adapter resolves for print', listJobWorkOrdersFromState().some((j) => j.challanNos.includes('EXEC-CH-REJ')))
  } else {
    check('Send material succeeds', false, 'no line')
    check('Outbound movement', false)
    check('Receive material', false)
    check('NCR on reject', false)
    check('Vendor metrics', false)
    check('Close blocked', false)
    check('Print data', false)
  }
} else {
  check('Subcontract WO exists', false)
}

console.log('\n═══════════════════════════════════════════════════════')
console.log(` RESULT: ${passed} passed, ${failed} failed`)
console.log('═══════════════════════════════════════════════════════')
process.exit(failed > 0 ? 1 : 0)
