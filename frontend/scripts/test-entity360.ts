/**
 * Entity 360 metrics — BOM 360 + Customer 360
 * npm run test:entity360
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

const { getBom360Data, getCustomer360Data } = await import('../src/utils/entity360Metrics')
const { entity360CustomerPath, resolveCompany360Path, salesCustomer360Path, customer360Path } = await import('../src/config/entity360Routes')
const { useBomStore } = await import('../src/store/bomStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { seedSalesOrders } = await import('../src/data/mrp/seed')

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

console.log('\n=== BOM 360 ===')

const bomId = 'bom-bulker-a'
const bom360 = getBom360Data(bomId)
check('BOM 360 resolves seed BOM', !!bom360, bom360?.bom.bomNo)
check('BOM has product link', bom360?.product?.id === 'prod-45m3')
check('BOM tree has leaf lines', (bom360?.leafLines.length ?? 0) > 0, `${bom360?.leafLines.length} leaves`)
check('BOM total cost > 0', (bom360?.totalCost ?? 0) > 0)
check('BOM is released revision', bom360?.isReleased === true)
check('BOM source mix counts', (bom360?.sourceCounts.make ?? 0) + (bom360?.sourceCounts.buy ?? 0) > 0)
check('BOM has revisions for product', (bom360?.revisions.length ?? 0) >= 1)
check('BOM has routing for product', (bom360?.routings.length ?? 0) >= 1)
check('Released routing has operations', (bom360?.routingOps.length ?? 0) > 0, `${bom360?.routingOps.length} ops`)

const missingBom = getBom360Data('bom-does-not-exist')
check('Unknown BOM returns null', missingBom === null)

console.log('\n=== Customer 360 ===')

const customerId = 'cust-abc'
const cust360 = getCustomer360Data(customerId)
check('Customer 360 resolves seed customer', !!cust360, cust360?.customer.customerCode)
check('entity360 customer path', entity360CustomerPath(customerId) === '/entity360/customers/cust-abc')
check(
  'company 360 CRM context',
  resolveCompany360Path(customerId, '/crm/customers') === entity360CustomerPath(customerId),
)
check(
  'company 360 Sales context',
  resolveCompany360Path(customerId, '/sales/orders/new') === salesCustomer360Path(customerId),
)
check(
  'company 360 Masters context',
  resolveCompany360Path(customerId, '/masters/companies') === customer360Path(customerId),
)
check('Customer has sales orders from seed', (cust360?.openSo.length ?? 0) + (cust360?.closedSo.length ?? 0) > 0)

useMrpStore.setState({ salesOrders: [...seedSalesOrders] })
const cust360After = getCustomer360Data(customerId)
const soCount = (cust360After?.openSo.length ?? 0) + (cust360After?.closedSo.length ?? 0)
check('Customer SO count matches MRP seed', soCount >= 1, `${soCount} orders`)

const utcl = getCustomer360Data('cust-utcl')
check('UltraTech customer resolves', utcl?.customer.customerName === 'UltraTech Cement Ltd.')
check('Customer pipeline arrays exist', Array.isArray(cust360After?.customerOpportunities) && Array.isArray(cust360After?.customerQuotations))
check('Customer WO array exists', Array.isArray(cust360After?.customerWorkOrders))
check('Customer activity feed', (cust360After?.activity.length ?? 0) > 0)

const missingCust = getCustomer360Data('cust-missing')
check('Unknown customer returns null', missingCust === null)

console.log('\n=== Global index helpers ===')
const boms = useBomStore.getState().bomHeaders
check('BOM headers indexed in store', boms.some((b) => b.id === bomId))
const customers = useMasterStore.getState().customers
check('Customers indexed in store', customers.some((c) => c.id === customerId))

console.log(`\nEntity 360: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
