/**
 * End-to-end business simulation — npx tsx scripts/simulate-e2e.ts
 *
 * SO-0001: ABC Cement · 2× 45 M3 Bulker · 30-day delivery
 * Flow: Sales Order → BOM → Reservation → MRP → Purchase Suggestion → Work Order
 */
import { seedSalesOrders } from '../src/data/mrp/seed'
import { seedBomHeaders, seedBomLines } from '../src/data/bom/seed'
import {
  seedItems,
  seedProducts,
  seedWarehouses,
  seedUoms,
  seedVendors,
  seedItemVendorMaps,
  seedCustomers,
} from '../src/data/masters/seed'
import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'
import { buildBomTree } from '../src/utils/bom'
import { computeOnHand, computeReservedQty, computeFreeQty } from '../src/utils/inventory'
import { buildMrpContext, runMrpForSalesOrder } from '../src/utils/mrpEngine'
import { getReleasedBomForProduct } from '../src/utils/mrp'

const SO_NO = 'SO-0001'
const AXLE = 'item-bo-axl'
const WH_BO = 'wh-bo-main'
const WH_RM = 'wh-rm-main'

const uomCode = (id: string) => seedUoms.find((u) => u.id === id)?.uomCode ?? '?'
const whCode = (id: string) => seedWarehouses.find((w) => w.id === id)?.warehouseCode ?? '?'
const itemCode = (id: string) => seedItems.find((i) => i.id === id)?.itemCode ?? '?'

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

console.log('═══════════════════════════════════════════════════════')
console.log(' E2E Simulation: ABC Cement · 2× 45 M3 Bulker Trailer')
console.log('═══════════════════════════════════════════════════════\n')

// ── Step 1: Sales Order ──
const so = seedSalesOrders.find((s) => s.salesOrderNo === SO_NO)!
const customer = seedCustomers.find((c) => c.id === so.customerId)!
const product = seedProducts.find((p) => p.id === so.productId)!
const fgItem = seedItems.find((i) => i.id === product.fgItemId)!

console.log('── Step 1: Sales Order ──')
check('SO exists', !!so, `${SO_NO} qty=${so.qty}`)
check('Customer is ABC Cement', customer.customerName === 'ABC Cement')
check('Product is 45 M3 Bulker', product.productName === '45 M3 Bulker Trailer')
check('Delivery ~30 days', so.requiredDate >= new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10))

// ── Step 2: BOM Explosion ──
console.log('\n── Step 2: BOM Explosion ──')
const bom = getReleasedBomForProduct(seedBomHeaders, product.id)
check('Released BOM exists', bom?.status === 'released', `rev ${bom?.revision}`)
const lines = seedBomLines.filter((l) => l.bomHeaderId === bom?.id)
const tree = buildBomTree(bom!, lines, seedItems, uomCode, whCode)
const runGear = tree.find((n) => n.itemCode === 'SA-RUN-GEAR')
const tank = tree.find((n) => n.itemCode === 'SA-TANK-ASM')
check('Running Gear sub-assembly in BOM', !!runGear, `${runGear?.children.length} components`)
check('Tank sub-assembly in BOM', !!tank, `${tank?.children.length} components`)
const plateLine = lines.find((l) => l.itemId === 'item-rm-plt')
check('MS Plate issue warehouse = RM_STORE', whCode(plateLine!.issueWarehouseId) === 'RM_STORE')

// ── Step 3: Inventory baseline ──
console.log('\n── Step 3: Inventory Baseline ──')
const axleOnHand = computeOnHand(seedStockMovements, AXLE, WH_BO)
const axleReserved = computeReservedQty(seedReservations, AXLE, WH_BO)
const axleFree = computeFreeQty(axleOnHand, axleReserved)
check('Axle on-hand = 1', axleOnHand === 1)
check('Axle reserved = 0 (SO-0001 clean)', axleReserved === 0)
check('Axle free = 1', axleFree === 1)

const plateOnHand = computeOnHand(seedStockMovements, 'item-rm-plt', WH_RM)
check('MS Plate on-hand = 6000 kg', plateOnHand === 6000, `actual ${plateOnHand}`)

// ── Step 4: Reservation (simulate SO reservation for available stock) ──
console.log('\n── Step 4: Reservation ──')
const reservations = [...seedReservations]
function simulateReservation(itemId: string, whId: string, qty: number, demandId: string) {
  const onHand = computeOnHand(seedStockMovements, itemId, whId)
  const reserved = computeReservedQty(reservations, itemId, whId)
  const free = computeFreeQty(onHand, reserved)
  const toReserve = Math.min(qty, free)
  if (toReserve > 0) {
    reservations.push({
      id: `sim-res-${itemId}`,
      itemId,
      warehouseId: whId,
      qty: toReserve,
      demandType: 'SO',
      demandId,
      referenceNo: demandId,
      remarks: 'E2E simulation reservation',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  return toReserve
}

const axleReservedForSo = simulateReservation(AXLE, WH_BO, 2, SO_NO)
check('Reserved 1 axle for SO (partial — only 1 free)', axleReservedForSo === 1)

const axleFreeAfter = computeFreeQty(
  computeOnHand(seedStockMovements, AXLE, WH_BO),
  computeReservedQty(reservations, AXLE, WH_BO),
)
check('Axle free after reservation = 0', axleFreeAfter === 0)

// ── Step 5: MRP Run ──
console.log('\n── Step 5: MRP Run ──')
const ctx = buildMrpContext(
  { salesOrderId: so.id, productId: product.id, qty: so.qty, requiredDate: so.requiredDate },
  so,
  product,
  fgItem,
  seedBomHeaders,
  seedBomLines,
  seedItems,
  seedWarehouses,
  seedStockMovements,
  reservations,
  seedItemVendorMaps,
  seedVendors,
  uomCode,
  whCode,
)
const mrp = runMrpForSalesOrder(ctx)
check('MRP material lines generated', mrp.materials.length > 0, `${mrp.materials.length} lines`)
check('MRP exceptions = 0', mrp.exceptions.length === 0)
check('WO requirements generated', mrp.woRequirements.length > 0, `${mrp.woRequirements.length} sub-assemblies`)

const axleLine = mrp.materials.find((m) => m.itemCode === 'BO-AXL-ABS6620')
check('Axle required qty = 2', axleLine?.requiredQty === 2, `actual ${axleLine?.requiredQty}`)
check('Axle shortage = 1', axleLine?.shortageQty === 1, `actual ${axleLine?.shortageQty}`)
check('Axle PO suggestion > 0', (axleLine?.suggestedPoQty ?? 0) > 0, `suggest ${axleLine?.suggestedPoQty}`)

const plateMrp = mrp.materials.find((m) => m.itemCode === 'RM-MS-PLT-16')
check('MS Plate shortage > 0', (plateMrp?.shortageQty ?? 0) > 0, `short ${plateMrp?.shortageQty} kg`)
check('MS Plate warehouse = RM_STORE', plateMrp?.warehouseCode === 'RM_STORE')

const tyreLine = mrp.materials.find((m) => m.itemCode === 'BO-TYRE-925')
check('Tyre shortage > 0', (tyreLine?.shortageQty ?? 0) > 0, `short ${tyreLine?.shortageQty}`)

const rimLine = mrp.materials.find((m) => m.itemCode === 'BO-RIM-925')
check('Rim shortage > 0', (rimLine?.shortageQty ?? 0) > 0, `short ${rimLine?.shortageQty}`)

// ── Step 6: Purchase Suggestions ──
console.log('\n── Step 6: Purchase Suggestions ──')
const purchaseLines = mrp.materials.filter((m) => m.suggestedPoQty > 0)
check('Purchase suggestions exist', purchaseLines.length >= 4, `${purchaseLines.length} items to buy`)
const axleVendor = axleLine?.preferredVendor
check('Axle preferred vendor = BPW', axleVendor === 'BPW', axleVendor ?? 'none')
const plateVendor = plateMrp?.preferredVendor
check('Plate preferred vendor = Local Steel Supplier', plateVendor === 'Local Steel Supplier', plateVendor ?? 'none')

console.log('\n  Top purchase suggestions:')
for (const m of purchaseLines.slice(0, 8)) {
  console.log(`    ${m.itemCode.padEnd(20)} qty=${String(m.suggestedPoQty).padStart(6)}  vendor=${m.preferredVendor ?? '—'}  wh=${m.warehouseCode}`)
}

// Simulate PR lines from MRP
const prLines = mrp.materials.filter((m) => m.suggestedPoQty > 0 || m.suggestedPrQty > 0)
check('PR would have lines', prLines.length > 0, `${prLines.length} lines`)
check('All PR lines have MRP link', prLines.every((m) => m.id && m.warehouseId))

// ── Step 7: Work Order ──
console.log('\n── Step 7: Work Order ──')
const woRunGear = mrp.woRequirements.find((w) => w.itemCode === 'SA-RUN-GEAR')
check('WO requirement: Running Gear', !!woRunGear, `qty ${woRunGear?.requiredQty}`)
const woTank = mrp.woRequirements.find((w) => w.itemCode === 'SA-TANK-ASM')
check('WO requirement: Tank Assembly', !!woTank, `qty ${woTank?.requiredQty}`)
check('WO can be released (BOM released, demand pegged)', bom?.status === 'released' && mrp.materials.length > 0)

console.log('\n═══════════════════════════════════════════════════════')
console.log(` Results: ${pass} passed, ${fail} failed`)
console.log(fail === 0 ? ' E2E SIMULATION PASS' : ' E2E SIMULATION FAIL')
console.log('═══════════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
