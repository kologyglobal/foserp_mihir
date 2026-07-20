/**
 * CRM Enterprise — npm run test:crm-enterprise
 * P3: forecast, unified inbox, command palette, multi-line SO, mobile CRM routes.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(k: string) {
    return mem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    mem.set(k, v)
  },
  removeItem(k: string) {
    mem.delete(k)
  },
  key() {
    return null
  },
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { resetCrmBootstrapGuard } = await import('../src/demo/factories/crmEcosystemBootstrap')
const { useCrmStore } = await import('../src/store/crmStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { getUnifiedInboxData } = await import('../src/utils/controlTowerMetrics')
const { buildCrmSalesForecast } = await import('../src/utils/crmForecastMetrics')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { createEmptyOpportunityLine, syncOpportunityLines } = await import('../src/utils/opportunityLineCalc')

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

console.log('\nCRM Enterprise Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const crm = useCrmStore.getState()
const masters = useMasterStore.getState()
const products = masters.products.filter((p) => p.isActive && p.status === 'released')

check(1, 'Sales forecast route registered', read('src/routes/crmRoutes.tsx').includes("path: 'forecast'"))
check(2, 'Sales forecast page exists', read('src/modules/crm/CrmSalesForecastPage.tsx').includes('CrmSalesForecastPage'))
check(3, 'CRM nav includes Sales Forecast', read('src/config/navigation.ts').includes("path: '/crm/forecast'"))

const forecast = buildCrmSalesForecast(crm.opportunities)
check(4, 'Forecast metrics compute pipeline and weighted values', forecast.openCount > 0 && forecast.pipelineValue > 0 && forecast.weightedForecast > 0)

const inboxBefore = getUnifiedInboxData()
const pendingCrmDoc = crm.quotationDocuments.find((d) => d.status === 'pending_approval')
if (!pendingCrmDoc) {
  const openOpp = crm.opportunities.find((o) => o.status === 'open' && !o.quotationId)
  if (openOpp) {
    const q = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2200000)
    if (q.documentId) crm.submitQuotationDocumentForApproval(q.documentId)
  }
}
const inbox = getUnifiedInboxData()
const crmApprovals = inbox.approvals.filter((a) => a.module === 'CRM')
check(5, 'Unified inbox includes CRM quotation approvals', crmApprovals.some((a) => a.href.startsWith('/crm/quotations/')))
check(
  6,
  'Sales quotation approval links to CRM',
  inbox.approvals.every((a) => !a.title.startsWith('Customer approval') || a.href.startsWith('/crm/')),
  `inbox approvals: ${inbox.approvals.length}`,
)

const globalSearch = read('src/components/design-system/GlobalSearch.tsx')
check(7, 'Command palette has New Lead quick action', globalSearch.includes('/crm/leads/new'))
check(8, 'Command palette has New Opportunity quick action', globalSearch.includes('/crm/opportunities/new'))
check(9, 'Command palette has New Quotation quick action', globalSearch.includes('/crm/quotations/new'))

const mobileRoutes = read('src/routes/mobileRoutes.tsx')
check(10, 'Mobile CRM leads route exists', mobileRoutes.includes("path: 'crm/leads'"))
check(11, 'Mobile CRM quotations route exists', mobileRoutes.includes("path: 'crm/quotations'"))
check(12, 'Mobile CRM sales orders route exists', mobileRoutes.includes("path: 'crm/sales-orders'"))

const p1 = products[0]!
const p2 = products.find((p) => p.id !== p1.id) ?? p1
const customerId = masters.customers[0]?.id ?? 'cust-crm-01'
const multiLines = syncOpportunityLines([
  createEmptyOpportunityLine(1, {
    productId: p1.id,
    productOrItem: p1.productName,
    itemCode: p1.productCode,
    unitPrice: 1500000,
    qty: 1,
    taxPct: 18,
    uom: 'Nos',
  }),
  createEmptyOpportunityLine(2, {
    productId: p2.id,
    productOrItem: p2.productName,
    itemCode: p2.productCode,
    unitPrice: 900000,
    qty: 1,
    taxPct: 18,
    uom: 'Nos',
  }),
])

const multiOpp = crm.createOpportunity({
  customerId,
  contactId: null,
  productId: p1.id,
  opportunityName: 'Enterprise multi-line SO test',
  productRequirement: 'Two products on one deal',
  lines: multiLines,
  stage: 'qualified',
  value: multiLines.reduce((s, l) => s + l.lineTotal, 0),
  probability: 60,
  expectedCloseDate: '2026-11-30',
  ownerId: 'user-rajesh',
  ownerName: 'Rajesh Kumar',
  priority: 'high',
  status: 'open',
  lostReason: null,
  inquiryId: null,
  quotationId: null,
  salesOrderId: null,
  leadId: null,
  nextFollowUpDate: null,
})

let multiLineOk = false
if (multiOpp.ok && multiOpp.opportunityId) {
  const q = crm.createQuotationFromOpportunity(multiOpp.opportunityId, 'qtpl-iso-tank', 2400000)
  if (q.documentId) {
    crm.approveQuotationDocument(q.documentId, 'Enterprise multi-line test')
    const conv = crm.convertQuotationDocumentToSalesOrder(q.documentId, {
      customerPoNumber: 'PO-MULTI-001',
      expectedDeliveryDate: '2026-12-15',
      deliveryLocation: 'Pune',
    })
    if (conv.ok && conv.salesOrderId) {
      const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
      const productIds = (so?.lines ?? []).map((l) => l.productId).filter(Boolean)
      multiLineOk =
        p1.id !== p2.id &&
        (so?.lines.length ?? 0) >= 2 &&
        new Set(productIds).size >= 2 &&
        productIds.includes(p1.id) &&
        productIds.includes(p2.id)
    }
  }
}
check(13, 'Multi-line SO maps productId per opportunity line', multiLineOk)

check(14, 'Contact detail route registered', read('src/routes/crmRoutes.tsx').includes("path: 'contacts/:id', element: <Contact360Page />"))
check(15, 'Contact360 page exists', read('src/modules/crm/Contact360Page.tsx').includes('Contact360Page'))

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
