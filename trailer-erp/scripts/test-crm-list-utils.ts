/**
 * CRM list utilities — npm run test:crm-list-utils
 * P3/P4: filter/sort/saved-view helpers and navigation polish.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

const { sortLeadRows, serializeLeadFilters, DEFAULT_LEAD_LIST_FILTERS } = await import('../src/utils/leadListUtils')
const { sortOpportunities } = await import('../src/utils/opportunityUtils')
const { sortSalesOrders } = await import('../src/utils/salesDashboardMetrics')
const { CONTACT_REGISTER_PRESETS, OPPORTUNITY_REGISTER_PRESETS } = await import('../src/config/savedViewPresets')
const { displayLostReason } = await import('../src/utils/opportunityUtils')

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

console.log('\nCRM List Utils Tests\n')

const leadRows = [
  {
    lead: { expectedValue: 100, lastModifiedAt: '2026-01-01', leadOwnerName: 'A', createdDate: '2025-12-01', probability: 10, stage: 'new' as const },
    prospectDisplay: 'Beta',
  },
  {
    lead: { expectedValue: 500, lastModifiedAt: '2026-06-01', leadOwnerName: 'B', createdDate: '2026-01-01', probability: 80, stage: 'qualified' as const },
    prospectDisplay: 'Alpha',
  },
] as Parameters<typeof sortLeadRows>[0]

const byValue = sortLeadRows(leadRows, 'expectedValue')
check(1, 'sortLeadRows orders by expected value desc', byValue[0]?.lead.expectedValue === 500)

const serialized = serializeLeadFilters({ ...DEFAULT_LEAD_LIST_FILTERS, search: 'acme' })
check(2, 'serializeLeadFilters stringifies filter fields', serialized.search === 'acme')

const opps = [
  { opportunityName: 'B', value: 100, probability: 50, expectedCloseDate: '2026-12-01', ownerName: 'X', stage: 'qualified' as const, lastActivityAt: null },
  { opportunityName: 'A', value: 900, probability: 70, expectedCloseDate: '2026-08-01', ownerName: 'Y', stage: 'negotiation' as const, lastActivityAt: '2026-06-01' },
]
const sortedOpps = sortOpportunities(opps, 'value')
check(3, 'sortOpportunities orders by deal value', sortedOpps[0]?.value === 900)

const orders = [
  { id: '1', salesOrderNo: 'SO-002', customerId: 'c2', productId: 'p1', qty: 1, status: 'open' as const, orderDate: '2026-02-01', requiredDate: '2026-03-01', createdAt: '2026-02-01' },
  { id: '2', salesOrderNo: 'SO-001', customerId: 'c1', productId: 'p1', qty: 1, status: 'open' as const, orderDate: '2026-01-01', requiredDate: '2026-04-01', createdAt: '2026-01-01' },
] as Parameters<typeof sortSalesOrders>[0]
const sortedOrders = sortSalesOrders(orders, 'soNo', () => 0, () => '')
check(4, 'sortSalesOrders orders by SO number', sortedOrders[0]?.salesOrderNo === 'SO-001')

check(5, 'Contact saved view presets include sortBy', Boolean(CONTACT_REGISTER_PRESETS['Primary Contacts']?.sortBy))
check(6, 'Opportunity saved view presets include sortBy', Boolean(OPPORTUNITY_REGISTER_PRESETS.Negotiation?.sortBy))

const oppFilterConfig = read('src/config/crmOpportunityFilterConfig.ts')
check(7, 'Opportunity filter config includes lostReason', oppFilterConfig.includes("key: 'lostReason'"))

const navigation = read('src/config/navigation.ts')
check(8, 'Sales nav no longer lists Inquiries', !navigation.includes("path: '/sales/inquiries'"))
check(9, 'Sales nav includes Quotation Approvals', navigation.includes("path: '/sales/approvals'"))

const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)
check(10, 'Legacy SO /360 redirects to canonical detail', routes.includes('SalesOrder360LegacyRedirect'))

const salesPages = read('src/modules/sales/SalesPages.tsx')
check(11, 'Inquiry detail page removed from sales module', !salesPages.includes('export function InquiryDetailPage'))

check(12, 'displayLostReason handles empty', displayLostReason('') === '—')

check(13, 'CRM sales order detail route registered', read('src/routes/crmRoutes.tsx').includes("path: 'sales-orders/:id'"))
check(14, 'Companies export enabled in command bar', !read('src/modules/crm/CrmEntityPages.tsx').includes("Export coming in CRM Reports"))
check(15, 'SalesOrdersTable uses CRM detail path in crmMode', read('src/components/sales/SalesOrdersTable.tsx').includes('resolveSalesOrderDetailPath'))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
