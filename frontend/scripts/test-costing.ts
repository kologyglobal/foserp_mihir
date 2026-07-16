/**
 * P4 Production Costing Engine
 * npx tsx scripts/test-costing.ts
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
const { useCostingStore } = await import('../src/store/costingStore')
const { useBomStore } = await import('../src/store/bomStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useWorkCenterStore } = await import('../src/store/workCenterStore')
const { costSheetTotals } = await import('../src/types/costing')
const { bomStandardUnitCost, computePlannedMaterial, computeActualMaterial } = await import(
  '../src/utils/costEngine'
)

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
  useCostingStore.setState({ overheadPct: 10 })
}

function ensureMaterials(woId: string) {
  for (const line of useWorkOrderStore.getState().getWoMaterials(woId)) {
    const free = useInventoryStore.getState().getFreeQty(line.itemId, line.warehouseId)
    if (free < line.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.requiredQty - free + 10,
        referenceNo: 'TEST-COST-INW',
        remarks: 'Test inward for costing',
      })
    }
  }
}

function buildInput(woId: string) {
  const overheadPct = useCostingStore.getState().overheadPct
  const woStore = useWorkOrderStore.getState()
  const wo = woStore.getWorkOrder(woId)
  if (!wo) return null
  const bomStore = useBomStore.getState()
  const master = useMasterStore.getState()
  return {
    workOrder: wo,
    materialLines: woStore.getWoMaterials(woId),
    productionOps: woStore.getProductionOperations(woId),
    jobCards: woStore.getJobCards(woId),
    movements: useInventoryStore.getState().stockMovements,
    subcontractShipments: woStore.subcontractShipments.filter((s) => s.workOrderId === woId),
    childWorkOrders: woStore.workOrders.filter((c) => c.parentWoId === woId),
    childCostSheets: [],
    bomTree: wo.bomHeaderId ? bomStore.getBomTree(wo.bomHeaderId) : [],
    bomLines: wo.bomHeaderId ? bomStore.getLines(wo.bomHeaderId) : [],
    items: master.items,
    workCenters: useWorkCenterStore.getState().workCenters,
    overheadPct,
  }
}

console.log('=== P4 Production Costing Engine ===\n')
reset()

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)

const wos = useWorkOrderStore.getState().workOrders
const tankWo = wos.find((w) => w.woNo === 'WO-0001')
const fgWo = wos.find((w) => w.woType === 'finished_goods')

check('WOs created', wos.length >= 5, `count=${wos.length}`)
check('Tank SA WO exists', !!tankWo, tankWo?.woNo)
check('FG WO exists', !!fgWo, fgWo?.woNo)

for (const wo of wos) {
  const sheet = useCostingStore.getState().getCostSheet(wo.id)
  check(`Cost sheet for ${wo.woNo}`, !!sheet && sheet.costSheetId === `CS-${wo.woNo}`)
}

if (tankWo) {
  const input = buildInput(tankWo.id)
  if (input) {
    const plannedMat = computePlannedMaterial(input)
    check('SA planned material > 0', plannedMat > 0, String(plannedMat))
    const bomStd = bomStandardUnitCost(input)
    check('BOM standard unit cost > 0', bomStd > 0, String(bomStd))
  }
}

if (tankWo) {
  const store = useWorkOrderStore.getState()
  store.planWorkOrder(tankWo.id)
  store.releaseWorkOrder(tankWo.id)
  ensureMaterials(tankWo.id)
  store.reserveMaterials(tankWo.id)
  store.issueAllReserved(tankWo.id)

  const actualMat = computeActualMaterial(tankWo.id, useInventoryStore.getState().stockMovements)
  check('Actual material after issue > 0', actualMat > 0, String(actualMat))

  const sheet = useCostingStore.getState().getCostSheet(tankWo.id)!
  const totals = costSheetTotals(sheet)
  check('Actual material on cost sheet matches', totals.actualMaterial === actualMat)
  check('Variance vs BOM computable', Number.isFinite(totals.variancePct))
}

if (fgWo) {
  const fgSheet = useCostingStore.getState().getCostSheet(fgWo.id)!
  const childCount = wos.filter((w) => w.parentWoId === fgWo.id).length
  check('FG has child WOs linked', childCount >= 3, `children=${childCount}`)
  check('FG cost sheet has roll-up fields', typeof fgSheet.rolledUpChildPlanned === 'number')
}

useCostingStore.getState().setOverheadPct(15)
if (tankWo) {
  const sheet15 = useCostingStore.getState().getCostSheet(tankWo.id)!
  useCostingStore.getState().setOverheadPct(5)
  const sheet5 = useCostingStore.getState().getCostSheet(tankWo.id)!
  check('Higher overhead increases planned total', sheet15.planned.overhead > sheet5.planned.overhead)
}

check('Variance report rows', useCostingStore.getState().getVarianceReport().length === wos.length)
check('Trailer profitability', useCostingStore.getState().getTrailerProfitability().length >= 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
