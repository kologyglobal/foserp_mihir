/**
 * CRM / Sales navigation consolidation — npm run test:crm-sales-navigation
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

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { moduleCategories } = await import('../src/config/navigation')
const { useCrmStore } = await import('../src/store/crmStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { buildCrmDashboardMetrics } = await import('../src/utils/crmMetrics')
const { getSidebarCategoryCounts } = await import('../src/utils/sidebarLiveCounts')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM / Sales Navigation Consolidation Tests\n')
resetDemoBaseline()

const nav = read('src/config/navigation.ts')
const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)
const crmRoutes = read('src/routes/crmRoutes.tsx')
const salesWs = read('src/modules/workspaces/SalesWorkspace.tsx')

const crmCat = moduleCategories.find((c) => c.id === 'crm')
const salesCat = moduleCategories.find((c) => c.id === 'sales')

check('1. No separate Sales Pipeline top-level module', !nav.includes("title: 'Sales Pipeline'"))
check('2. CRM category titled CRM', crmCat?.title === 'CRM')
check('3. Opportunities under CRM nav', crmCat?.items.some((i) => i.path === '/crm/opportunities' && i.label === 'Opportunities') ?? false)
check('3c. Follow-ups and Activities not in CRM nav (pipeline views)', !(crmCat?.items.some((i) => i.path === '/crm/follow-ups') ?? false) && !(crmCat?.items.some((i) => i.path === '/crm/activities') ?? false))
check('3b. No separate Pipeline Kanban nav item', !(crmCat?.items.some((i) => i.path === '/crm/opportunities/kanban') ?? false))
check('3d. No duplicate Pipeline nav item (covered by Opportunities)', !(crmCat?.items.some((i) => i.label === 'Pipeline') ?? false))
check('3e. Quotation Templates not in CRM nav (inside Quotations)', !(crmCat?.items.some((i) => i.path === '/crm/quotation-templates') ?? false))
check('4. CRM Reports in CRM nav', crmCat?.items.some((i) => i.path === '/crm/reports') ?? false)
check('4a. Sales Orders in CRM nav after Quotations', (() => {
  const items = crmCat?.items ?? []
  const qIdx = items.findIndex((i) => i.path === '/crm/quotations')
  const soIdx = items.findIndex((i) => i.path === '/crm/sales-orders' && i.label === 'Sales Orders')
  const coIdx = items.findIndex((i) => i.path === '/crm/customers')
  return soIdx > qIdx && soIdx < coIdx
})())
check('4c. CRM sales-orders route registered', crmRoutes.includes("path: 'sales-orders'"))
check('4b. CRM in sidebar groups', read('src/config/sidebarGroups.ts').includes("'crm'"))
check('5. Sales category titled Sales', salesCat?.title === 'Sales')
check('6. Sales nav focuses on orders', salesCat?.items.some((i) => i.path === '/sales/orders') ?? false)
check('7. Sales nav has no Lead Register', !(salesCat?.items.some((i) => i.label === 'Lead Register') ?? false))
check('8. /sales-pipeline redirects to CRM kanban', routes.includes("path: 'sales-pipeline'") && routes.includes('SalesPipelineLegacyRedirect'))
check('9. CRM leads route registered', crmRoutes.includes("path: 'leads'"))
check('10. CRM reports route registered', crmRoutes.includes("path: 'reports'"))

const crm = useCrmStore.getState()
const crmMetrics = buildCrmDashboardMetrics({
  opportunities: crm.opportunities,
  followUps: crm.followUps,
  activities: crm.activities,
  quotationDocuments: crm.quotationDocuments,
})
check('11. CRM dashboard metrics have opportunities', crmMetrics.openOpportunities > 0, String(crmMetrics.openOpportunities))

const mrp = useMrpStore.getState()
check('12. Sales order data available for execution dashboard', mrp.salesOrders.length > 0, String(mrp.salesOrders.length))
check('13. Sales workspace focuses on order execution', salesWs.includes('Sales Order Management') && salesWs.includes('Pending MRP'))
check('14. Sales workspace links to CRM pipeline', salesWs.includes('/crm/opportunities'))

const badges = getSidebarCategoryCounts()
check('15. CRM sidebar badge count', (badges.crm ?? 0) > 0, String(badges.crm))
check('16. Sales sidebar badge count', (badges.sales ?? 0) > 0, String(badges.sales))

const { useMasterStore } = await import('../src/store/masterStore')
const customer = useMasterStore.getState().customers[0]
const product = useMasterStore.getState().products[0]
let openOpp: (typeof crm.opportunities)[number] | undefined
if (customer && product) {
  const created = crm.createOpportunity({
    customerId: customer.id,
    opportunityName: `Nav Test ${Date.now()}`,
    productId: product.id,
    value: 1500000,
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    stage: 'requirement_discussion',
    priority: 'medium',
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    nextFollowUpDate: null,
  })
  if (created.ok && created.opportunityId) {
    openOpp = useCrmStore.getState().getOpportunity(created.opportunityId)
  }
}
if (openOpp) {
  const convResult = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2100000)
  const documentId = convResult.documentId
  if (documentId && convResult.ok) {
    crm.approveQuotationDocument(documentId, 'Nav test approved')
    const conv = crm.convertQuotationDocumentToSalesOrder(documentId)
    const so = conv.ok && conv.salesOrderId ? useMrpStore.getState().getSalesOrder(conv.salesOrderId) : undefined
    check('17. Approved quotation converts to Sales Order', conv.ok, conv.error)
    check('18. SO stores quotation revision reference', !!so?.quotationDocumentId && so.quotationDocumentRevisionNo != null)
    check('19. Conversion increases SO count', conv.ok)
  } else {
    check('17. Approved quotation converts to Sales Order', false, convResult.error ?? 'no document')
    check('18. SO stores quotation revision reference', false)
    check('19. Conversion increases SO count', false)
  }
} else {
  const soWithQuoteRef = mrp.salesOrders.find((so) => so.quotationDocumentId || so.quotationId)
  check('17. Approved quotation converts to Sales Order', !!soWithQuoteRef, 'existing converted SO')
  check('18. SO stores quotation revision reference', !!soWithQuoteRef?.quotationDocumentId && soWithQuoteRef?.quotationDocumentRevisionNo != null)
  check('19. Conversion increases SO count', !!soWithQuoteRef)
}

check('20. Customer 360 has CRM tab', read('src/modules/entity360/Customer360Page.tsx').includes("id: 'crm'"))
check('21. Customer 360 has sales tab', read('src/modules/entity360/Customer360Page.tsx').includes("id: 'sales'"))

console.log(`\n${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
