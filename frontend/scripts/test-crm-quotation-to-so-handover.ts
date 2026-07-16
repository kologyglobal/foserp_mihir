/**
 * CRM Quotation → Sales Order handover — npm run test:crm-quotation-to-so-handover
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
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { buildCrmDashboardMetrics } = await import('../src/utils/crmMetrics')
const {
  validateQuotationForSoConversion,
  isQuotationExpired,
} = await import('../src/utils/crmQuotationSoConversion')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { moduleCategories } = await import('../src/config/navigation')

let pass = 0
let fail = 0
let conv: { ok: boolean; salesOrderId?: string } = { ok: false }

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM Quotation → Sales Order Handover Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetDemoBaseline()

const crm = useCrmStore.getState()
const sales = useSalesStore.getState()
const masters = useMasterStore.getState()

let openOpp = crm.opportunities.find((o) => !o.quotationId && o.productId && o.status === 'open')
if (!openOpp) {
  const cust = masters.customers[0]
  const created = crm.createOpportunity({
    customerId: cust.id,
    contactId: null,
    productId: 'prod-45m3',
    opportunityName: 'SO handover test opportunity',
    productRequirement: 'Test requirement',
    stage: 'qualified',
    value: 2500000,
    probability: 50,
    expectedCloseDate: '2026-12-31',
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
  if (created.ok && created.opportunityId) {
    openOpp = useCrmStore.getState().getOpportunity(created.opportunityId)
  }
}

let documentId: string | undefined
let quotationId: string | undefined
let oldRevisionDocId: string | undefined

if (openOpp) {
  const r = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-standard-trailer', 2100000)
  quotationId = r.quotationId
  documentId = r.documentId

  const draftDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined
  if (draftDoc) {
    const draftVal = validateQuotationForSoConversion({
      document: draftDoc,
      latestDocument: draftDoc,
      salesQuotation: quotationId ? sales.getQuotation(quotationId) : undefined,
      customer: quotationId ? masters.getCustomer(sales.getQuotation(quotationId)!.customerId) : undefined,
    })
    check(2, 'Draft quotation cannot convert', !draftVal.canConvert)
  }

  if (documentId) {
    crm.submitQuotationDocumentForApproval(documentId)
    crm.rejectQuotationDocument(documentId, 'Test reject')
    const rejected = useCrmStore.getState().getQuotationDocument(documentId)!
    const rejVal = validateQuotationForSoConversion({
      document: rejected,
      latestDocument: rejected,
      salesQuotation: quotationId ? sales.getQuotation(quotationId) : undefined,
    })
    check(3, 'Rejected quotation cannot convert', !rejVal.canConvert)

    oldRevisionDocId = documentId
    const rev = crm.createQuotationRevision(documentId, 'Handover test revision')
    documentId = rev.documentId ?? documentId
    crm.submitQuotationDocumentForApproval(documentId)
    crm.approveQuotationDocument(documentId, 'Handover approved')
  }
}

const approvedDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined
const salesQuo = quotationId ? useSalesStore.getState().getQuotation(quotationId) : undefined
const customer = salesQuo ? masters.getCustomer(salesQuo.customerId) : undefined

if (approvedDoc) {
  const approvedVal = validateQuotationForSoConversion({
    document: approvedDoc,
    latestDocument: approvedDoc,
    salesQuotation: salesQuo,
    customer,
  })
  check(1, 'Approved quotation can convert to sales order', approvedVal.canConvert)

  const expiredQuo = salesQuo ? { ...salesQuo, validityDate: '2020-01-01' } : undefined
  check(4, 'Expired quotation cannot convert', isQuotationExpired(expiredQuo))

  if (oldRevisionDocId) {
    const oldDoc = useCrmStore.getState().getQuotationDocument(oldRevisionDocId)!
    const oldVal = validateQuotationForSoConversion({
      document: oldDoc,
      latestDocument: approvedDoc,
      salesQuotation: salesQuo,
      customer,
    })
    check(5, 'Old quotation revision cannot convert', !oldVal.canConvert)
  }

  check(6, 'Create Sales Order action routes to new SO form', read('src/components/quotations/ConvertQuotationToSOAction.tsx').includes('Create Sales Order') && read('src/utils/opportunitySalesOrderDraft.ts').includes('/sales/orders/new'))
  check(7, 'Required conversion fields validate', approvedVal.issues.filter((i) => i.blocking).length === 0)

  conv = crm.convertQuotationDocumentToSalesOrder(documentId!, {
    customerPoNumber: 'PO-HANDOVER-001',
    expectedDeliveryDate: '2026-10-15',
    deliveryLocation: 'Pune Plant',
    internalRemarks: 'CRM handover test',
  })
  check(8, 'Sales Order is created from approved quotation', conv.ok, conv.salesOrderId)

  if (conv.ok && conv.salesOrderId) {
    const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
    check(9, 'SO stores quotation number and revision', Boolean(so?.quotationNo && so?.quotationRevisionNo))
    const convertedDoc = useCrmStore.getState().getQuotationDocument(documentId!)!
    check(10, 'Quotation status becomes Converted', convertedDoc.status === 'converted')
    const opp = openOpp ? useCrmStore.getState().getOpportunity(openOpp.id) : undefined
    check(11, 'Opportunity status becomes Won', opp?.status === 'won')
    const timeline = useCrmStore.getState().activities.find((a) => a.quotationId === quotationId && a.type === 'sales_order_created')
    check(12, 'CRM timeline event is created', Boolean(timeline?.description?.includes('converted to Sales Order')))
    check(13, 'Converted quotation links sales order id', Boolean(convertedDoc.salesOrderId))
    check(14, 'Sales Order appears in /sales/orders data', useMrpStore.getState().salesOrders.some((o) => o.id === conv.salesOrderId))
  }
}

const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)
const salesPages = read('src/modules/sales/SalesPages.tsx')
const convertAction = read('src/components/quotations/ConvertQuotationToSOAction.tsx')
const quotation360 = read('src/modules/quotations/Quotation360Page.tsx')
const nav = moduleCategories.find((c) => c.id === 'sales')

check(15, 'Sales Order list has View action', salesPages.includes('View'))
check(16, 'Sales Order list has Edit action', salesPages.includes('Edit'))
check(17, 'Sales Order view page route exists', routes.includes("path: 'sales/orders/:id'"))
check(18, 'Draft SO edit page route exists', routes.includes("path: 'sales/orders/:id/edit'"))

const editResult = conv.salesOrderId
  ? useMrpStore.getState().updateSalesOrderDraft(conv.salesOrderId, { internalRemarks: 'Saved from test' })
  : { ok: false }
check(19, 'Draft SO edit page saves', editResult.ok)

check(20, 'CRM does not show Run MRP button', !quotation360.includes('Run MRP') && !quotation360.includes('triggerProduction'))
check(21, 'CRM has no production/dispatch/invoice actions in convert flow', !convertAction.includes('runMrp') && !convertAction.includes('createInvoice'))
check(22, 'Sales Order menu exists under Sales module', nav?.items.some((i) => i.path === '/sales/orders') ?? false)

const metrics = buildCrmDashboardMetrics({
  opportunities: useCrmStore.getState().opportunities,
  followUps: crm.followUps,
  activities: useCrmStore.getState().activities,
  quotationDocuments: useCrmStore.getState().quotationDocuments,
})
check(23, 'CRM dashboard handover metrics exist', typeof metrics.approvedQuotationsNotConverted === 'number')
check(24, 'Quotation builder module still present', read('package.json').includes('test:quotation-template-builder'))

resetSessionUserForTests()

console.log(`\n${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
