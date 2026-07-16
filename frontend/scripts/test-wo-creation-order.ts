/**
 * WO creation order — tank sub-assembly is always WO-0001 on SO-0001 MRP run.
 * npx tsx scripts/test-wo-creation-order.ts
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

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)

const wos = useWorkOrderStore.getState().workOrders.sort((a, b) => a.woNo.localeCompare(b.woNo))
const expected = [
  { woNo: 'WO-0001', code: 'SA-TANK-ASM', type: 'manufactured_sub_assembly' },
  { woNo: 'WO-0002', code: 'SA-CHASSIS', type: 'manufactured_sub_assembly' },
  { woNo: 'WO-0003', code: 'SA-RUN-GEAR', type: 'manufactured_sub_assembly' },
  { woNo: 'WO-0004', code: 'SA-PAINT-SYS', type: 'subcontract' },
  { woNo: 'WO-0005', code: 'FG-BULKER-45M3', type: 'finished_goods' },
]

let pass = 0
let fail = 0
for (const exp of expected) {
  const wo = wos.find((w) => w.woNo === exp.woNo)
  const ok = wo?.outputItemCode === exp.code && wo?.woType === exp.type
  console.log(`${ok ? '✓' : '✗'} ${exp.woNo} → ${exp.code} (${exp.type})`)
  if (ok) pass++
  else fail++
}

const tank = wos.find((w) => w.woNo === DEMO_WO_ANCHORS.tankAssemblyWoNo)
console.log(`\nAnchor: ${DEMO_WO_ANCHORS.tankAssemblyWoNo} = ${tank?.outputItemCode} — Tank Welding QC demo WO`)
console.log(`Results: ${pass}/${expected.length} passed`)
if (fail > 0) process.exitCode = 1
