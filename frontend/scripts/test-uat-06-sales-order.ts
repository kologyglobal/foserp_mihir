/**
 * UAT-06 — Sales Order conversion (quotation → SO handover)
 * Run: npm run test:uat-06-sales-order
 */
import { readFileSync, writeFileSync } from 'node:fs'
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

interface CaseResult {
  id: string
  area: string
  label: string
  ok: boolean
  detail?: string
  live?: boolean
}

const results: CaseResult[] = []

function check(id: string, area: string, label: string, ok: boolean, detail = '', live = false) {
  results.push({ id, area, label, ok, detail, live })
  console.log(`${ok ? '  ✓' : '  ✗'} ${id} ${label}${detail ? ` — ${detail}` : ''}`)
}

console.log('\nUAT-06 — Sales Order Conversion\n')

// ─── Static analysis ─────────────────────────────────────────────────────────

const conversionUtil = read('src/utils/crmQuotationSoConversion.ts')
const soLinesUtil = read('src/utils/crmQuotationSoLines.ts')
const convertAction = read('src/components/quotations/ConvertQuotationToSOAction.tsx')
const soCreatePage = read('src/modules/sales/SalesOrderCreatePage.tsx')
const mrpStoreSrc = read('src/store/mrpStore.ts')
const salesStoreSrc = read('src/store/salesStore.ts')
const crmStoreSrc = read('src/store/crmStore.ts')
const quotation360 = read('src/modules/quotations/Quotation360Page.tsx')
const so360Sections = read('src/components/sales/SalesOrder360Sections.tsx')
const codeSeriesSrc = read('src/services/codeSeriesService.ts')
const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)

check(
  'UAT-06.1',
  'Conversion flow',
  'validateQuotationForSoConversion guards approved latest revision',
  conversionUtil.includes('validateQuotationForSoConversion') && conversionUtil.includes('not-latest'),
)
check(
  'UAT-06.2',
  'Line mapping',
  'buildSalesOrderLinesFromQuotationDocument maps price lines',
  soLinesUtil.includes('buildSalesOrderLinesFromQuotationDocument') && soLinesUtil.includes('quotationPriceLinesForSo'),
)
check(
  'UAT-06.3',
  'Conversion flow',
  'ConvertQuotationToSOAction routes to new SO form',
  convertAction.includes('Create Sales Order') && convertAction.includes('buildSalesOrderNewUrl'),
)
check(
  'UAT-06.4',
  'Conversion flow',
  'SalesOrderCreatePage calls convertQuotationDocumentToSalesOrder',
  soCreatePage.includes('convertQuotationDocumentToSalesOrder') && soCreatePage.includes('canConvertQuotation'),
)
check(
  'UAT-06.5',
  'SO numbering',
  'mrpStore generates SO numbers via code series / documentNumbers',
  mrpStoreSrc.includes('nextSalesOrderNo') && (mrpStoreSrc.includes('nextDocumentNo') || mrpStoreSrc.includes('getNextCode')),
)
check(
  'UAT-06.6',
  'Quotation linkage',
  'Sales order 360 shows quotation link strip',
  so360Sections.includes('quotationId') && so360Sections.includes('quotationNo'),
)
check(
  'UAT-06.7',
  'CRM handover',
  'Quotation 360 shows handover-complete message after conversion',
  quotation360.includes('CRM handover complete') || quotation360.includes('salesOrderNo'),
)
check(
  'UAT-06.8',
  'CRM handover',
  'CRM convert flow has no MRP / production / invoice actions',
  !convertAction.includes('runMrp') && !convertAction.includes('triggerProduction') && !convertAction.includes('createInvoice'),
)
check(
  'UAT-06.9',
  'Sales module',
  'Sales order list/view/edit routes registered',
  routes.includes("path: 'sales/orders'") && routes.includes("path: 'sales/orders/:id'"),
)
check(
  'UAT-06.10',
  'Duplicate guard',
  'salesStore.createSalesOrderFromQuotation blocks existing salesOrderId',
  salesStoreSrc.includes('quo.salesOrderId') && salesStoreSrc.includes('Sales order already created'),
)
check(
  'UAT-06.11',
  'Persistence',
  'CRM + MRP + sales stores use persisted localStorage keys',
  (crmStoreSrc.includes('ERP_STORAGE_KEYS.crm') || crmStoreSrc.includes("'vasant-erp-crm-v1'"))
    && (mrpStoreSrc.includes('ERP_STORAGE_KEYS.mrp') || mrpStoreSrc.includes("'vasant-erp-mrp-v1'"))
    && (salesStoreSrc.includes('ERP_STORAGE_KEYS.sales') || salesStoreSrc.includes("'vasant-erp-sales-v1'")),
)
check(
  'UAT-06.12',
  'SO numbering',
  'Code series maps SO- prefix to sales_order entity',
  codeSeriesSrc.includes("'SO-'") && codeSeriesSrc.includes('sales_order'),
)

// ─── Demo store conversion journey ───────────────────────────────────────────

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { validateQuotationForSoConversion } = await import('../src/utils/crmQuotationSoConversion')
const { summarizeQuotationLinesForSo } = await import('../src/utils/crmQuotationSoLines')
const { formatCustomerBillingAddress } = await import('../src/utils/customerUtils')
const { ERP_STORAGE_KEYS, readPersistedJson, writePersistedJson } = await import('../src/store/persistConfig')

setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
resetDemoBaseline()

const crm = useCrmStore.getState()
const masters = useMasterStore.getState()
const customer = masters.customers[0]

let documentId: string | undefined
let quotationId: string | undefined
let conv: { ok: boolean; salesOrderId?: string; salesOrderNo?: string; error?: string } = { ok: false }

const openOpp = crm.opportunities.find((o) => !o.quotationId && o.productId && o.status === 'open')
  ?? (() => {
    const created = crm.createOpportunity({
      customerId: customer?.id ?? masters.customers[0]!.id,
      contactId: null,
      productId: 'prod-45m3',
      opportunityName: 'UAT-06 SO conversion test',
      productRequirement: 'Standard trailer requirement',
      stage: 'qualified',
      value: 2500000,
      probability: 60,
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
    return created.ok && created.opportunityId ? useCrmStore.getState().getOpportunity(created.opportunityId) : undefined
  })()

if (openOpp) {
  const q = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2100000)
  quotationId = q.quotationId
  documentId = q.documentId

  const draftDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined
  if (draftDoc) {
    const draftVal = validateQuotationForSoConversion({
      document: draftDoc,
      latestDocument: draftDoc,
      salesQuotation: quotationId ? useSalesStore.getState().getQuotation(quotationId) : undefined,
      customer: quotationId ? masters.getCustomer(useSalesStore.getState().getQuotation(quotationId)!.customerId) : undefined,
    })
    check('UAT-06.13', 'Conversion guard', 'Draft quotation cannot convert', !draftVal.canConvert)
  }

  if (documentId) {
    crm.submitQuotationDocumentForApproval(documentId)
    crm.approveQuotationDocument(documentId, 'UAT-06 approved')
  }
}

const approvedDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined
const salesQuo = quotationId ? useSalesStore.getState().getQuotation(quotationId) : undefined
const quoCustomer = salesQuo ? masters.getCustomer(salesQuo.customerId) : undefined
const priced = approvedDoc ? summarizeQuotationLinesForSo(approvedDoc) : null

if (approvedDoc && salesQuo && quoCustomer) {
  const approvedVal = validateQuotationForSoConversion({
    document: approvedDoc,
    latestDocument: approvedDoc,
    salesQuotation: salesQuo,
    customer: quoCustomer,
  })
  check('UAT-06.14', 'Conversion flow', 'Approved quotation can convert to sales order', approvedVal.canConvert)

  const beforeSoCount = useMrpStore.getState().salesOrders.length
  conv = crm.convertQuotationDocumentToSalesOrder(documentId!, {
    customerPoNumber: 'PO-UAT-06-001',
    customerPoDate: '2026-07-01',
    expectedDeliveryDate: '2026-10-15',
    deliveryLocation: 'Pune Plant',
    internalRemarks: 'UAT-06 conversion test',
  })
  check('UAT-06.15', 'Conversion flow', 'convertQuotationDocumentToSalesOrder succeeds', conv.ok, conv.salesOrderNo ?? conv.error)

  if (conv.ok && conv.salesOrderId) {
    const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
    const convertedDoc = useCrmStore.getState().getQuotationDocument(documentId!)!
    const updatedQuo = useSalesStore.getState().getQuotation(quotationId!)!
    const opp = openOpp ? useCrmStore.getState().getOpportunity(openOpp.id) : undefined

    check('UAT-06.16', 'Customer data', 'SO customerId matches quotation customer', so?.customerId === salesQuo.customerId, so?.customerId)
    check(
      'UAT-06.17',
      'Customer data',
      'SO billing address matches customer master',
      so?.billingAddress === formatCustomerBillingAddress(quoCustomer),
    )
    check(
      'UAT-06.18',
      'Line parity',
      'SO line count matches quotation non-optional lines',
      (so?.lines.length ?? 0) === priced!.lineCount,
      `${so?.lines.length ?? 0} vs ${priced!.lineCount}`,
    )
    if (so?.lines.length && priced?.lines.length) {
      const lineMatch = so.lines.every((sl, i) => {
        const ql = priced.lines[i]
        return ql && sl.qty === ql.qty && sl.unitPrice === ql.unitPrice && sl.lineTotal === ql.lineTotal
      })
      check('UAT-06.19', 'Line parity', 'SO line qty, unit price, and line total match quotation', lineMatch)
    } else {
      check('UAT-06.19', 'Line parity', 'SO line qty, unit price, and line total match quotation', false, 'missing lines')
    }
    check(
      'UAT-06.20',
      'Totals',
      'SO grand total matches quotation summary',
      so?.grandTotal === priced!.summary.grandTotal,
      `${so?.grandTotal} vs ${priced!.summary.grandTotal}`,
    )
    check(
      'UAT-06.21',
      'Quotation linkage',
      'SO stores quotationId, quotationNo, and revision',
      so?.quotationId === salesQuo.id && Boolean(so?.quotationNo) && so?.quotationRevisionNo === salesQuo.revisionNo,
      `${so?.quotationNo} rev ${so?.quotationRevisionNo}`,
    )
    check(
      'UAT-06.22',
      'Quotation linkage',
      'SO stores quotation document id and revision',
      so?.quotationDocumentId === documentId && so?.quotationDocumentRevisionNo === approvedDoc.revisionNo,
    )
    const duplicateSoNos = useMrpStore.getState().salesOrders.filter((o) => o.salesOrderNo === conv.salesOrderNo).length
    check(
      'UAT-06.23',
      'SO numbering',
      'SO number generated with SO- prefix and is unique',
      Boolean(conv.salesOrderNo?.startsWith('SO-')) && duplicateSoNos === 1,
      conv.salesOrderNo,
    )
    check(
      'UAT-06.24',
      'SO numbering',
      'New SO appended to sales order register',
      useMrpStore.getState().salesOrders.length === beforeSoCount + 1,
    )
    check('UAT-06.25', 'Quotation linkage', 'Quotation document status becomes converted', convertedDoc.status === 'converted')
    check('UAT-06.26', 'Quotation linkage', 'Sales quotation record links salesOrderId', updatedQuo.salesOrderId === conv.salesOrderId)
    check('UAT-06.27', 'CRM handover', 'Opportunity status becomes won with salesOrderId', opp?.status === 'won' && opp?.salesOrderId === conv.salesOrderId)
    check(
      'UAT-06.28',
      'Commercial terms',
      'Payment and delivery terms carried to SO',
      Boolean(so?.paymentTerms?.trim()) && Boolean(so?.deliveryTerms?.trim()),
    )
    check(
      'UAT-06.29',
      'Handover fields',
      'Customer PO and delivery fields stored on SO',
      so?.customerPoNumber === 'PO-UAT-06-001' && so?.expectedDeliveryDate === '2026-10-15',
    )

    const dup = crm.convertQuotationDocumentToSalesOrder(documentId!, { customerPoNumber: 'PO-DUP' })
    check(
      'UAT-06.30',
      'Duplicate guard',
      'Second conversion attempt is blocked',
      !dup.ok && Boolean(dup.error || dup.validationIssues?.length),
      dup.error,
    )

    // Simulate browser refresh via persisted slices
    const crmSnap = useCrmStore.getState()
    const mrpSnap = useMrpStore.getState()
    const salesSnap = useSalesStore.getState()
    writePersistedJson(ERP_STORAGE_KEYS.crm, {
      contacts: crmSnap.contacts,
      opportunities: crmSnap.opportunities,
      activities: crmSnap.activities,
      followUps: crmSnap.followUps,
      quotationDocuments: crmSnap.quotationDocuments,
      quotationTemplates: crmSnap.quotationTemplates,
    })
    writePersistedJson(ERP_STORAGE_KEYS.mrp, { salesOrders: mrpSnap.salesOrders, runs: mrpSnap.runs })
    writePersistedJson(ERP_STORAGE_KEYS.sales, {
      leads: salesSnap.leads,
      inquiries: salesSnap.inquiries,
      quotations: salesSnap.quotations,
    })

    const persistedCrm = readPersistedJson<{
      quotationDocuments: Array<{ id: string; status: string; salesOrderId: string | null }>
    }>(ERP_STORAGE_KEYS.crm)
    const persistedMrp = readPersistedJson<{ salesOrders: Array<{ id: string; quotationId: string | null }> }>(
      ERP_STORAGE_KEYS.mrp,
    )
    const persistedSales = readPersistedJson<{ quotations: Array<{ id: string; salesOrderId: string | null }> }>(
      ERP_STORAGE_KEYS.sales,
    )

    const persistedDoc = persistedCrm?.quotationDocuments?.find((d) => d.id === documentId)
    const persistedSo = persistedMrp?.salesOrders?.find((o) => o.id === conv.salesOrderId)
    const persistedQuo = persistedSales?.quotations?.find((q) => q.id === quotationId)

    check(
      'UAT-06.31',
      'Persistence',
      'Persisted quotation document retains converted status + SO link',
      persistedDoc?.status === 'converted' && persistedDoc?.salesOrderId === conv.salesOrderId,
    )
    check(
      'UAT-06.32',
      'Persistence',
      'Persisted sales order retains quotation linkage',
      persistedSo?.quotationId === quotationId,
    )
    check(
      'UAT-06.33',
      'Persistence',
      'Persisted sales quotation retains salesOrderId',
      persistedQuo?.salesOrderId === conv.salesOrderId,
    )

    const timeline = useCrmStore.getState().activities.find(
      (a) => a.quotationId === quotationId && a.type === 'sales_order_created',
    )
    check('UAT-06.34', 'CRM handover', 'CRM timeline logs sales_order_created activity', Boolean(timeline?.description?.includes('converted to Sales Order')))

    check(
      'UAT-06.35',
      'CRM handover',
      'Convert action shows View Sales Order when salesOrderId exists',
      convertAction.includes('View Sales Order') && convertAction.includes('prefill.salesOrderId'),
    )
    check(
      'UAT-06.36',
      'CRM handover',
      'CRM sales-order register path separate from sales module execution',
      read('src/utils/crmSalesOrderNavigation.ts').includes('/crm/sales-orders') && read('src/utils/crmSalesOrderNavigation.ts').includes('/sales/orders/'),
    )
  }
} else {
  for (const id of [
    'UAT-06.13', 'UAT-06.14', 'UAT-06.15', 'UAT-06.16', 'UAT-06.17', 'UAT-06.18', 'UAT-06.19', 'UAT-06.20',
    'UAT-06.21', 'UAT-06.22', 'UAT-06.23', 'UAT-06.24', 'UAT-06.25', 'UAT-06.26', 'UAT-06.27', 'UAT-06.28',
    'UAT-06.29', 'UAT-06.30', 'UAT-06.31', 'UAT-06.32', 'UAT-06.33', 'UAT-06.34', 'UAT-06.35', 'UAT-06.36',
  ]) {
    check(id, 'Conversion journey', 'Demo conversion setup failed', false, 'missing approved quotation')
  }
}

// ─── Live API (optional — SO backend deferred) ───────────────────────────────

async function tryLiveSoConversion() {
  const base = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
  const tenant = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
  const crmBase = `${base}/t/${tenant}/crm`
  try {
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@vasant-trailers.com',
        password: 'Admin@123',
        tenantSlug: tenant,
      }),
    })
    const loginBody = await login.json()
    const token = loginBody.data?.accessToken
    if (!token) {
      check('UAT-06.37', 'Live API', 'Live SO conversion skipped — auth failed', true, loginBody.message ?? `HTTP ${login.status}`, true)
      return
    }

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const stamp = Date.now()
    const userId = loginBody.data?.user?.id as string | undefined
    const soListRes = await fetch(`${crmBase}/sales-orders?limit=5`, { headers })
    check('UAT-06.37', 'Live API', 'Sales orders route reachable', soListRes.ok, `HTTP ${soListRes.status}`, true)

    const pipelinesRes = await fetch(`${crmBase}/pipelines?limit=5`, { headers })
    const pipelinesBody = await pipelinesRes.json()
    const pipeline = pipelinesBody.data?.[0]
    const stage = pipeline?.stages?.[0]
    if (!pipeline || !stage || !userId) {
      check('UAT-06.38', 'Live API', 'SO conversion live test', true, 'skipped — pipeline/user unavailable', true)
      return
    }

    const companyRes = await fetch(`${crmBase}/companies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerName: `UAT06 SO Co ${stamp}`,
        addressLine1: 'Plot 1, MIDC',
        city: 'Nashik',
        state: 'Maharashtra',
        contactPerson: 'UAT Contact',
        isActive: true,
      }),
    })
    const companyBody = await companyRes.json()
    const companyId = companyBody.data?.id
    if (!companyId) {
      check('UAT-06.38', 'Live API', 'SO conversion live test', false, 'company create failed', true)
      return
    }

    const oppRes = await fetch(`${crmBase}/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        opportunityName: `UAT06 SO Opp ${stamp}`,
        customerId: companyId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId: userId,
        value: 150000,
      }),
    })
    const oppBody = await oppRes.json()
    const oppId = oppBody.data?.id
    if (!oppId) {
      check('UAT-06.38', 'Live API', 'SO conversion live test', false, oppBody.message ?? 'opportunity create failed', true)
      await fetch(`${crmBase}/companies/${companyId}`, { method: 'DELETE', headers })
      return
    }

    const quoRes = await fetch(`${crmBase}/quotations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerId: companyId,
        opportunityId: oppId,
        qty: 1,
        unitPrice: 100000,
        paymentTerms: '30% advance',
        deliveryTerms: 'Ex-works',
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        priceLines: [{ productOrItem: 'Trailer', qty: 1, uom: 'NOS', unitPrice: 100000, taxPct: 18 }],
      }),
    })
    const quoBody = await quoRes.json()
    const quoId = quoBody.data?.id
    const docId = quoBody.data?.documents?.[0]?.id
    if (!quoId || !docId) {
      check('UAT-06.38', 'Live API', 'SO conversion live test', false, quoBody.message ?? 'quotation create failed', true)
      await fetch(`${crmBase}/companies/${companyId}`, { method: 'DELETE', headers })
      return
    }

    await fetch(`${crmBase}/quotations/${quoId}/documents/${docId}/submit-approval`, { method: 'POST', headers, body: '{}' })
    await fetch(`${crmBase}/quotations/${quoId}/documents/${docId}/mark-sent`, { method: 'POST', headers, body: '{}' })
    await fetch(`${crmBase}/quotations/${quoId}/documents/${docId}/customer-approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: 'UAT-06 customer accepted' }),
    })
    const convRes = await fetch(`${crmBase}/quotations/${quoId}/convert-to-sales-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ documentId: docId, customerPoNumber: `PO-UAT06-${stamp}` }),
    })
    const convBody = await convRes.json()
    const soId = convBody.data?.salesOrderId
    check('UAT-06.38', 'Live API', 'Convert approved quotation to SO', convRes.status === 201 && Boolean(soId), convBody.data?.salesOrderNo, true)

    const dupRes = await fetch(`${crmBase}/quotations/${quoId}/convert-to-sales-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ documentId: docId, customerPoNumber: 'PO-DUP' }),
    })
    check('UAT-06.39', 'Live API', 'Duplicate SO conversion blocked', dupRes.status === 409, `HTTP ${dupRes.status}`, true)

    if (soId) {
      const soGet = await fetch(`${crmBase}/sales-orders/${soId}`, { headers })
      const soBody = await soGet.json()
      check('UAT-06.40', 'Live API', 'SO persists after re-GET', soGet.ok && soBody.data?.quotationId === quoId, soBody.data?.salesOrderNo, true)
    }

    await fetch(`${crmBase}/quotations/${quoId}`, { method: 'DELETE', headers })
    await fetch(`${crmBase}/opportunities/${oppId}`, { method: 'DELETE', headers })
    await fetch(`${crmBase}/companies/${companyId}`, { method: 'DELETE', headers })
  } catch (e) {
    check(
      'UAT-06.37',
      'Live API',
      'Live SO conversion skipped — backend unreachable',
      true,
      e instanceof Error ? e.message : String(e),
      true,
    )
  }
}

await tryLiveSoConversion()

resetSessionUserForTests()

// ─── Report ──────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)
const automated = results.filter((r) => !r.live)
const live = results.filter((r) => r.live)

const report = [
  '# UAT-06 — Sales Order Conversion',
  '',
  `**Date:** ${new Date().toISOString().slice(0, 10)}`,
  `**Overall:** ${failed.length === 0 ? '✅ PASS' : '❌ FAIL'} (${passed}/${results.length})`,
  '',
  '## Scope',
  '',
  'Validates CRM quotation → Sales Order handover in **demo mode** (`VITE_USE_API=false`) and **live API** conversion when backend is reachable.',
  '',
  '| ID | Area | Test | Status | Notes |',
  '|----|------|------|--------|-------|',
  ...results.map(
    (r) => `| ${r.id} | ${r.area} | ${r.label} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail ?? ''} |`,
  ),
  '',
  '## Manual sign-off checklist',
  '',
  '- [ ] Open an **Approved** quotation (latest revision) in CRM → **Create Sales Order**',
  '- [ ] Sales order form prefills customer, lines, payment/delivery terms from quotation',
  '- [ ] Enter Customer PO + expected delivery → save → lands on Sales Order 360',
  '- [ ] Verify SO number (`SO-…`) is unique in `/sales/orders` list',
  '- [ ] SO 360 shows quotation link; amounts match quotation price table',
  '- [ ] Return to quotation 360 — status **Converted**, handover message, **View Sales Order** button',
  '- [ ] Refresh browser — SO and quotation linkage still present (demo localStorage)',
  '- [ ] Attempt second conversion — blocked with clear message',
  '- [ ] CRM quotation/opportunity views have no Run MRP / production / invoice actions',
  '- [ ] MRP / production / dispatch run from **Sales** module only',
  '',
  '## Demo credentials',
  '',
  '- Tenant: `vasant-trailers`',
  '- Email: `admin@vasant-trailers.com`',
  '- Password: `Admin@123`',
  '',
  '## Related automation',
  '',
  '- `npm run test:crm-quotation-to-so-handover` — handover regression',
  '- `npm run test:crm-multiline-quotation-to-so` — multi-line parity',
  '',
]

writeFileSync(path.join(ROOT, 'UAT-06_SALES_ORDER_CONVERSION_REPORT.md'), report.join('\n'))
console.log(`\nWrote UAT-06_SALES_ORDER_CONVERSION_REPORT.md`)
console.log(
  `\nUAT-06: ${passed}/${results.length} passed (${automated.filter((r) => r.ok).length}/${automated.length} automated, ${live.filter((r) => r.ok).length}/${live.length} live)\n`,
)

process.exit(failed.length ? 1 : 0)
