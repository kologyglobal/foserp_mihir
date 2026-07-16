/**
 * P3 Semi-Finished Goods Receipt — SA_RECEIPT flow
 * npx tsx scripts/test-sa-receipt.ts
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
const { useMasterStore } = await import('../src/store/masterStore')

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
}

function ensureMaterials(woId: string) {
  for (const line of useWorkOrderStore.getState().getWoMaterials(woId)) {
    const free = useInventoryStore.getState().getFreeQty(line.itemId, line.warehouseId)
    if (free < line.requiredQty) {
      useInventoryStore.getState().postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.requiredQty - free + 10,
        referenceNo: 'TEST-SA-INW',
        remarks: 'Test inward for SA receipt flow',
      })
    }
  }
}

function fastCompleteWo(woId: string) {
  const store = useWorkOrderStore.getState()
  store.planWorkOrder(woId)
  store.releaseWorkOrder(woId)
  ensureMaterials(woId)
  store.reserveMaterials(woId)
  store.issueAllReserved(woId)
  return store.completeWorkOrder(woId)
}

console.log('═══════════════════════════════════════')
console.log(' P3 Semi-Finished Goods Receipt')
console.log('═══════════════════════════════════════\n')

reset()
const master = useMasterStore.getState()
const wipAssembly = master.warehouses.find((w) => w.warehouseCode === 'WIP_ASSEMBLY')!
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)

const wos = useWorkOrderStore.getState().workOrders
const tankWo = wos.find((w) => w.woNo === 'WO-0001')!
const chassisWo = wos.find((w) => w.outputItemCode === 'SA-CHASSIS')!
const runGearWo = wos.find((w) => w.outputItemCode === 'SA-RUN-GEAR')!
const fgWo = wos.find((w) => w.woType === 'finished_goods')!

console.log('── WO linkage & FG consumption lines ──')
check('Tank WO parent is FG WO', tankWo.parentWoId === fgWo.id, fgWo.woNo)
check('FG WO has SA-TANK-ASM material line', useWorkOrderStore.getState().getWoMaterials(fgWo.id).some((l) => l.itemCode === 'SA-TANK-ASM'))
check('FG SA line pegged to tank WO', useWorkOrderStore.getState().getWoMaterials(fgWo.id).find((l) => l.itemCode === 'SA-TANK-ASM')?.sourceWoId === tankWo.id)

console.log('\n── Complete Tank WO → Post SA Receipt ──')
const onHandBefore = useInventoryStore.getState().getOnHand(tankWo.outputItemId, wipAssembly.id)
check('Tank WO completes', fastCompleteWo(tankWo.id).ok)

const saReceiptResult = useWorkOrderStore.getState().postSaReceipt(tankWo.id)
check('Post SA receipt succeeds', saReceiptResult.ok, saReceiptResult.error)

const saMovement = useInventoryStore.getState().stockMovements.find(
  (m) => m.referenceType === 'SA_RECEIPT' && m.workOrderId === tankWo.id && m.warehouseId === wipAssembly.id,
)
check('SA_RECEIPT movement into WIP_ASSEMBLY', !!saMovement, saMovement?.movementNo)
check('Movement links source + parent WO', saMovement?.sourceWoId === tankWo.id && saMovement?.parentWoId === fgWo.id)
check('Stock increases in WIP_ASSEMBLY', useInventoryStore.getState().getOnHand(tankWo.outputItemId, wipAssembly.id) > onHandBefore)

const saReceipt = useWorkOrderStore.getState().getSaReceipts(tankWo.id)[0]
check('SaReceipt record created', !!saReceipt && saReceipt.status === 'posted')
check('Timeline logs semi-finished receipt', useWorkOrderStore.getState().activities.some((a) => a.action === 'Semi-Finished Receipt'))

console.log('\n── Parent FG WO gates & consumption ──')
useWorkOrderStore.getState().planWorkOrder(fgWo.id)
useWorkOrderStore.getState().releaseWorkOrder(fgWo.id)
const fgStartBlocked = useWorkOrderStore.getState().startProduction(fgWo.id)
check('FG start blocked before SA receipts & issue', !fgStartBlocked.ok, fgStartBlocked.error)

check('Chassis WO completes', fastCompleteWo(chassisWo.id).ok)
check('Chassis SA receipt posted', useWorkOrderStore.getState().postSaReceipt(chassisWo.id).ok)
check('Run gear WO completes', fastCompleteWo(runGearWo.id).ok)
check('Run gear SA receipt posted', useWorkOrderStore.getState().postSaReceipt(runGearWo.id).ok)

const paintLine = useWorkOrderStore.getState().getWoMaterials(fgWo.id).find((l) => l.itemCode === 'SA-PAINT-SYS')
if (paintLine) {
  const wipFinal = master.warehouses.find((w) => w.warehouseCode === 'WIP_FINAL')!
  useInventoryStore.getState().postInward({
    itemId: paintLine.itemId,
    warehouseId: wipFinal.id,
    qty: paintLine.requiredQty,
    referenceNo: 'TEST-PAINT-INW',
    remarks: 'Subcontract paint SA available for FG test',
  })
}

const tankLine = useWorkOrderStore.getState().getWoMaterials(fgWo.id).find((l) => l.itemCode === 'SA-TANK-ASM')!
const onHandTank = useInventoryStore.getState().getOnHand(tankLine.itemId, tankLine.warehouseId)
check('Parent FG WO sees SA-TANK-ASM available in WIP', onHandTank >= tankLine.requiredQty, `${onHandTank}/${tankLine.requiredQty}`)

useWorkOrderStore.getState().reserveMaterials(fgWo.id)
const consumeTank = useWorkOrderStore.getState().issueMaterialLine(fgWo.id, tankLine.id, tankLine.requiredQty)
check('Parent FG WO consumes SA-TANK-ASM', consumeTank.ok, consumeTank.error)

useWorkOrderStore.getState().issueAllReserved(fgWo.id)
const fgStart = useWorkOrderStore.getState().startProduction(fgWo.id)
check('FG WO can start after all materials issued', fgStart.ok, fgStart.error)

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exitCode = 1
