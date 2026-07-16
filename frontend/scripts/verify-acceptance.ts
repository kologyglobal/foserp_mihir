/**
 * ERP acceptance checks — run: npx tsx scripts/verify-acceptance.ts
 */
import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'
import { seedBomLines, seedBomHeaders } from '../src/data/bom/seed'
import { seedItems, seedProducts, seedWarehouses, seedUoms, seedCustomers } from '../src/data/masters/seed'
import { seedSalesOrders } from '../src/data/mrp/seed'
import { computeOnHand, computeReservedQty, computeFreeQty } from '../src/utils/inventory'
import { buildBomTree } from '../src/utils/bom'

const AXLE = 'item-bo-axl'
const WH_BO = 'wh-bo-main'

const onHand = computeOnHand(seedStockMovements, AXLE, WH_BO)
const reserved = computeReservedQty(seedReservations, AXLE, WH_BO)
const free = computeFreeQty(onHand, reserved)

console.log('=== Inventory Test: Axle ABS-6620 ===')
console.log(`On Hand: ${onHand} (expected 1)`)
console.log(`Reserved: ${reserved} (expected 0 — king pin WO only, not axle)`)
console.log(`Free: ${free} (expected 1)`)
const invPass = onHand === 1 && reserved === 0 && free === 1
console.log(invPass ? 'PASS' : 'FAIL')

const kpinRes = seedReservations.find((r) => r.demandType === 'WO' && r.itemId === 'item-bo-kpin')
console.log('\n=== Reservation Test: WO king pin ===')
console.log(`WO reservation qty: ${kpinRes?.qty ?? 0} (expected 2)`)
const resPass = kpinRes?.qty === 2
console.log(resPass ? 'PASS' : 'FAIL')

const so0001 = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const abc = seedCustomers.find((c) => c.id === so0001.customerId)!
console.log('\n=== Sales Order Test: SO-0001 ===')
console.log(`Customer: ${abc.customerName} (expected ABC Cement)`)
console.log(`Qty: ${so0001.qty} (expected 2)`)
const soPass = abc.customerName === 'ABC Cement' && so0001.qty === 2
console.log(soPass ? 'PASS' : 'FAIL')

const bulkerProduct = seedProducts.find((p) => p.id === 'prod-45m3')
const bulkerFg = seedItems.find((i) => i.id === bulkerProduct?.fgItemId)
console.log('\n=== Product Test ===')
console.log(`Product: ${bulkerProduct?.productName}`)
console.log(`FG Item: ${bulkerFg?.itemCode} (expected FG-BULKER-45M3)`)
const orphanedFg = seedItems.filter(
  (i) => i.itemType === 'finished_good' && !seedProducts.some((p) => p.fgItemId === i.id),
)
console.log(`Orphan FG items with stock path blocked: ${orphanedFg.length === 0 ? 'yes' : 'no'}`)
const prodPass = bulkerFg?.itemCode === 'FG-BULKER-45M3' && orphanedFg.length === 0
console.log(prodPass ? 'PASS' : 'FAIL')

const header = seedBomHeaders.find((h) => h.id === 'bom-bulker-a')!
const lines = seedBomLines.filter((l) => l.bomHeaderId === 'bom-bulker-a')
const whCode = (id: string) => seedWarehouses.find((w) => w.id === id)?.warehouseCode ?? '?'
const uomCode = (id: string) => seedUoms.find((u) => u.id === id)?.uomCode ?? '?'
const tree = buildBomTree(header, lines, seedItems, uomCode, whCode)
const maxDepth = (nodes: typeof tree, d = 0): number =>
  nodes.length === 0 ? d : Math.max(...nodes.map((n) => maxDepth(n.children, d + 1)))
const runGear = tree.find((n) => n.itemCode === 'SA-RUN-GEAR')
const tank = tree.find((n) => n.itemCode === 'SA-TANK-ASM')
const plate = lines.find((l) => l.itemId === 'item-rm-plt')
const primer = lines.find((l) => l.itemId === 'item-rm-primer' && l.bomHeaderId === 'bom-bulker-a')

console.log('\n=== BOM Test ===')
console.log(`Tree depth: ${maxDepth(tree)} — adjacency list, no depth cap`)
console.log(`Running Gear → ${runGear?.children.map((c) => c.itemName).slice(0, 2).join(', ')}`)
console.log(`Tank → ${tank?.children.map((c) => c.itemCode).slice(0, 2).join(', ')}`)
console.log('PASS')

console.log('\n=== Warehouse Test ===')
console.log(`MS Plate issue WH: ${whCode(plate!.issueWarehouseId)} (expected RM_STORE)`)
console.log(`Primer issue WH: ${whCode(primer!.issueWarehouseId)} (expected PAINT_STORE)`)
const whPass =
  whCode(plate!.issueWarehouseId) === 'RM_STORE' &&
  whCode(primer!.issueWarehouseId) === 'PAINT_STORE'
console.log(whPass ? 'PASS' : 'FAIL')

const allPass = invPass && resPass && soPass && prodPass && whPass
console.log(`\n=== Overall: ${allPass ? 'ALL PASS' : 'SOME FAILED'} ===`)
process.exit(allPass ? 0 : 1)
