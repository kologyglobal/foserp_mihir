/**
 * MRP engine smoke test — npx tsx scripts/verify-mrp.ts
 */
import { seedSalesOrders } from '../src/data/mrp/seed'
import { seedBomHeaders, seedBomLines } from '../src/data/bom/seed'
import { seedItems, seedProducts, seedWarehouses, seedUoms, seedVendors, seedItemVendorMaps } from '../src/data/masters/seed'
import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'
import { buildMrpContext, runMrpForSalesOrder } from '../src/utils/mrpEngine'
import { getReleasedBomForProduct } from '../src/utils/mrp'

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const product = seedProducts.find((p) => p.id === so.productId)!
const fgItem = seedItems.find((i) => i.id === product.fgItemId)!
const uomCode = (id: string) => seedUoms.find((u) => u.id === id)?.uomCode ?? '?'
const whCode = (id: string) => seedWarehouses.find((w) => w.id === id)?.warehouseCode ?? '?'

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
  seedReservations,
  seedItemVendorMaps,
  seedVendors,
  uomCode,
  whCode,
)

const bom = getReleasedBomForProduct(seedBomHeaders, product.id)
console.log('Released BOM:', bom?.revision, bom?.status)
const result = runMrpForSalesOrder(ctx)
console.log('Material lines:', result.materials.length)
console.log('WO requirements:', result.woRequirements.length)
console.log('Exceptions:', result.exceptions.length)
console.log('Pegging links:', result.pegging.length)

const axle = result.materials.find((m) => m.itemCode === 'BO-AXL-ABS6620')
console.log('\nAxle line:', axle ? {
  required: axle.requiredQty,
  onHand: axle.onHand,
  reserved: axle.reservedQty,
  free: axle.freeStock,
  shortage: axle.shortageQty,
  poSuggest: axle.suggestedPoQty,
  wh: axle.warehouseCode,
} : 'missing')

const plate = result.materials.find((m) => m.itemCode === 'RM-MS-PLT-16')
console.log('Plate issue WH:', plate?.warehouseCode, 'shortage:', plate?.shortageQty)

const woRunGear = result.woRequirements.find((w) => w.itemCode === 'SA-RUN-GEAR')
console.log('WO Running Gear qty:', woRunGear?.requiredQty)

const isoSo = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-2026-0180')!
const isoProd = seedProducts.find((p) => p.id === isoSo.productId)!
const isoFg = seedItems.find((i) => i.id === isoProd.fgItemId)!
const isoCtx = buildMrpContext(
  { salesOrderId: isoSo.id, productId: isoProd.id, qty: isoSo.qty, requiredDate: isoSo.requiredDate },
  isoSo, isoProd, isoFg,
  seedBomHeaders, seedBomLines, seedItems, seedWarehouses,
  seedStockMovements, seedReservations, seedItemVendorMaps, seedVendors,
  uomCode, whCode,
)
const isoResult = runMrpForSalesOrder(isoCtx)
console.log('\nISO Tank (no released BOM):', isoResult.exceptions.map((e) => e.type))

const ok =
  bom?.status === 'released' &&
  result.materials.length > 0 &&
  (axle?.shortageQty ?? 0) > 0 &&
  isoResult.exceptions.some((e) => e.type === 'no_released_bom')
console.log('\n', ok ? 'MRP VERIFY PASS' : 'MRP VERIFY FAIL')
process.exit(ok ? 0 : 1)
