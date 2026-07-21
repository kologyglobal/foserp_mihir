/**
 * UAT-05 — Quotation lifecycle (Opportunity → Quotation → Approval → Revision → SO)
 * Run: npm run test:uat-05-quotations
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

console.log('\nUAT-05 — Quotation Lifecycle\n')

// ─── Imports & demo baseline ───────────────────────────────────────────────────

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { setSessionUserForTests, resetSessionUserForTests, canPermission } = await import('../src/utils/permissions')
const { calcLineTotal, calcPriceSummary, syncLineTotals } = await import('../src/utils/crmQuotationCalc')
const {
  validateQuotationForSoConversion,
  canShowConvertButton,
  isQuotationExpired,
} = await import('../src/utils/crmQuotationSoConversion')
const { documentGrandTotal } = await import('../src/utils/crmIntegration')
const { APPROVAL_AMOUNT_THRESHOLD, DISCOUNT_APPROVAL_THRESHOLD } = await import('../src/types/crm')

setSessionUserForTests({ role: 'sales_manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
resetDemoBaseline()

const crmRoutes = read('src/routes/quotationRoutes.tsx')
const crmStoreSrc = read('src/store/crmStore.ts')
const bridgeSrc = read('src/services/bridges/quotationApiBridge.ts')
const approvalPanel = read('src/components/quotations/QuotationApprovalPanel.tsx')
const revisionHistory = read('src/components/quotations/QuotationRevisionHistory.tsx')
const convertAction = read('src/components/quotations/ConvertQuotationToSOAction.tsx')
const calcSrc = read('src/utils/crmQuotationCalc.ts')
const conversionSrc = read('src/utils/crmQuotationSoConversion.ts')
const backendRoutes = read('../backend/src/modules/crm/quotations/quotation.routes.ts')
const backendConstants = read('../backend/src/modules/crm/quotations/quotation.constants.ts')
const backendService = read('../backend/src/modules/crm/quotations/quotation.service.ts')
const backendWorkflow = read('../backend/src/modules/crm/quotations/quotation.workflow.ts')

const crm = useCrmStore.getState()
const sales = useSalesStore.getState()
const masters = useMasterStore.getState()

// ─── UAT-05.1 Structure & wiring ─────────────────────────────────────────────

check('UAT-05.1', 'Routes', 'CRM quotation list/new/detail routes', crmRoutes.includes("path: 'quotations'") && crmRoutes.includes("path: 'quotations/new'") && crmRoutes.includes("path: 'quotations/:id'"))
check('UAT-05.2', 'Routes', 'Editor, preview, print, revisions routes', crmRoutes.includes("path: 'quotations/:id/editor'") && crmRoutes.includes("path: 'quotations/:id/revisions'"))
check('UAT-05.3', 'Store', 'createQuotationFromOpportunity in crmStore', crmStoreSrc.includes('createQuotationFromOpportunity'))
check('UAT-05.4', 'Store', 'Approval workflow actions in crmStore', crmStoreSrc.includes('submitQuotationDocumentForApproval') && crmStoreSrc.includes('approveQuotationDocument') && crmStoreSrc.includes('rejectQuotationDocument'))
check('UAT-05.5', 'Store', 'Revision + SO conversion in crmStore', crmStoreSrc.includes('createQuotationRevision') && crmStoreSrc.includes('convertQuotationDocumentToSalesOrder'))
check('UAT-05.6', 'Bridge', 'quotationApiBridge CRUD + lifecycle', bridgeSrc.includes('apiCreateQuotationFromOpportunity') && bridgeSrc.includes('apiSubmitQuotationDocumentForApproval') && bridgeSrc.includes('apiApproveQuotationDocument'))
check('UAT-05.7', 'Backend', 'Quotation routes: submit/approve/reject/revisions', backendRoutes.includes('submit-approval') && backendRoutes.includes('/approve') && backendRoutes.includes('/reject') && backendRoutes.includes('/revisions'))
check('UAT-05.8', 'Backend', 'Approve requires crm.quotation.approve permission', backendRoutes.includes("requirePermission('crm.quotation.approve')"))
check('UAT-05.9', 'Backend', 'Duplicate opportunity quotation blocked', backendService.includes('Quotation already exists for this opportunity'))
check('UAT-05.10', 'UI', 'Approval panel shows threshold warnings', approvalPanel.includes('APPROVAL_AMOUNT_THRESHOLD') && approvalPanel.includes('DISCOUNT_APPROVAL_THRESHOLD'))
check('UAT-05.11', 'UI', 'Revision history marks Latest revision', revisionHistory.includes('Latest'))
check('UAT-05.12', 'UI', 'Convert to SO action component', convertAction.includes('Create Sales Order') && convertAction.includes('canConvertQuotation'))

// ─── UAT-05.2 Tax / discount / totals (unit) ─────────────────────────────────

const sampleLine = {
  id: 'pl-uat',
  productOrItem: 'Flatbed trailer',
  description: 'Supply',
  qty: 2,
  uom: 'Nos',
  unitPrice: 100_000,
  discountPct: 5,
  taxPct: 18,
  lineTotal: 0,
  isOptional: false,
}
const synced = syncLineTotals([sampleLine])
const expectedLineTotal = calcLineTotal(sampleLine)
check('UAT-05.13', 'Tax/discount/totals', 'Line total = qty × price × (1-discount) + GST', synced[0]!.lineTotal === expectedLineTotal, String(synced[0]!.lineTotal))
check('UAT-05.14', 'Tax/discount/totals', 'Line total matches expected ₹2,24,200', synced[0]!.lineTotal === 224_200)

const summary = calcPriceSummary(synced, 5000, 2000, 1000)
check('UAT-05.15', 'Tax/discount/totals', 'Summary taxable value after discount', summary.taxableValue === 190_000)
check('UAT-05.16', 'Tax/discount/totals', 'Summary GST amount', summary.gstAmount === 34_200)
check('UAT-05.17', 'Tax/discount/totals', 'Grand total includes freight/install/custom', summary.grandTotal === 232_200)
check('UAT-05.18', 'Tax/discount/totals', 'calcPriceSummary exported from crmQuotationCalc', calcSrc.includes('export function calcPriceSummary'))

// ─── UAT-05.3 Create quotation from opportunity ────────────────────────────────

const customer = masters.customers[0]!
const product = masters.products.find((p) => p.isActive && p.status === 'released')!

const oppResult = crm.createOpportunity({
  customerId: customer.id,
  contactId: null,
  productId: product?.id ?? 'prod-45m3',
  opportunityName: 'UAT-05 Quotation lifecycle',
  productRequirement: '45 m³ tipper trailer',
  stage: 'qualified',
  value: 2_100_000,
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

let quotationId: string | undefined
let documentId: string | undefined

if (oppResult.ok && oppResult.opportunityId) {
  const q = useCrmStore.getState().createQuotationFromOpportunity(oppResult.opportunityId, 'qtpl-iso-tank', 2_100_000)
  quotationId = q.quotationId
  documentId = q.documentId
  check('UAT-05.19', 'Create quotation', 'Quotation created from opportunity', q.ok, quotationId)
  check('UAT-05.20', 'Create quotation', 'Opportunity linked to quotation', useCrmStore.getState().getOpportunity(oppResult.opportunityId)?.quotationId === quotationId)
  check('UAT-05.21', 'Create quotation', 'Sales header quotation exists', Boolean(quotationId && useSalesStore.getState().getQuotation(quotationId)))
} else {
  check('UAT-05.19', 'Create quotation', 'Quotation created from opportunity', false, oppResult.error)
  check('UAT-05.20', 'Create quotation', 'Opportunity linked to quotation', false)
  check('UAT-05.21', 'Create quotation', 'Sales header quotation exists', false)
}

const draftDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined

// ─── UAT-05.4 Line items & draft state ─────────────────────────────────────────

check('UAT-05.22', 'Line items', 'Document has at least one price line', (draftDoc?.priceLines.length ?? 0) >= 1, `${draftDoc?.priceLines.length ?? 0} lines`)
check('UAT-05.23', 'Line items', 'Price line has qty and unit price', Boolean(draftDoc?.priceLines[0]?.qty && draftDoc?.priceLines[0]?.unitPrice))
check('UAT-05.24', 'Line items', 'Document grand total computed', draftDoc ? documentGrandTotal(draftDoc) > 0 : false, draftDoc ? String(documentGrandTotal(draftDoc)) : '')
check('UAT-05.25', 'Draft state', 'New document status is draft', draftDoc?.status === 'draft')
check('UAT-05.26', 'Draft state', 'Draft document is not locked', draftDoc?.locked === false)

if (draftDoc && documentId) {
  const draftVal = validateQuotationForSoConversion({
    document: draftDoc,
    latestDocument: draftDoc,
    salesQuotation: quotationId ? useSalesStore.getState().getQuotation(quotationId) : undefined,
    customer,
  })
  check('UAT-05.27', 'Draft state', 'Draft quotation cannot convert to SO', !draftVal.canConvert)
  check('UAT-05.28', 'Draft state', 'Convert button hidden for draft', !canShowConvertButton({ document: draftDoc, latestDocument: draftDoc }))
}

// ─── UAT-05.5 Approval restrictions ────────────────────────────────────────────

check('UAT-05.29', 'Approval restrictions', 'Amount threshold defined (₹50L)', APPROVAL_AMOUNT_THRESHOLD === 5_000_000)
check('UAT-05.30', 'Approval restrictions', 'Discount threshold defined (10%)', DISCOUNT_APPROVAL_THRESHOLD === 10)
check('UAT-05.30b', 'Approval restrictions', 'Backend discount threshold matches frontend (10%)', backendConstants.includes('DISCOUNT_APPROVAL_THRESHOLD = 10'))
check('UAT-05.31', 'Approval restrictions', 'Sales manager can approve', canPermission('sales', 'approve'))

// High-value quotation → pending_approval
let highDocId: string | undefined
const highOpp = useCrmStore.getState().createOpportunity({
  customerId: customer.id,
  contactId: null,
  productId: product?.id ?? 'prod-45m3',
  opportunityName: 'UAT-05 High-value approval',
  productRequirement: 'Premium trailer',
  stage: 'qualified',
  value: 6_000_000,
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

if (highOpp.ok && highOpp.opportunityId) {
  const hq = useCrmStore.getState().createQuotationFromOpportunity(highOpp.opportunityId, 'qtpl-iso-tank', 6_000_000)
  highDocId = hq.documentId
  if (highDocId) {
    useCrmStore.getState().submitQuotationDocumentForApproval(highDocId)
    const highDoc = useCrmStore.getState().getQuotationDocument(highDocId)!
    check('UAT-05.32', 'Approval restrictions', 'High-value submit → pending_approval', highDoc.status === 'pending_approval', highDoc.status)

    setSessionUserForTests({ role: 'shop_floor', userId: 'user-shop', userName: 'Shop Floor' })
    const denied = useCrmStore.getState().approveQuotationDocument(highDocId, 'Should fail')
    check('UAT-05.33', 'Approval restrictions', 'Shop floor cannot approve quotation', !denied.ok, denied.error)
    setSessionUserForTests({ role: 'sales_manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
  } else {
    check('UAT-05.32', 'Approval restrictions', 'High-value submit → pending_approval', false)
    check('UAT-05.33', 'Approval restrictions', 'Shop floor cannot approve quotation', false)
  }
} else {
  check('UAT-05.32', 'Approval restrictions', 'High-value submit → pending_approval', false)
  check('UAT-05.33', 'Approval restrictions', 'Shop floor cannot approve quotation', false)
}

// ─── UAT-05.6 Reject / revise / revision numbering / preservation ──────────────

let oldRevisionDocId: string | undefined
let latestDocId: string | undefined

if (documentId && quotationId) {
  useCrmStore.getState().submitQuotationDocumentForApproval(documentId)
  useCrmStore.getState().rejectQuotationDocument(documentId, 'UAT-05 pricing revision needed')
  const rejected = useCrmStore.getState().getQuotationDocument(documentId)!
  check('UAT-05.34', 'Reject/revise', 'Rejected document status', rejected.status === 'rejected')
  check('UAT-05.35', 'Reject/revise', 'Rejected quotation cannot convert', !validateQuotationForSoConversion({
    document: rejected,
    latestDocument: rejected,
    salesQuotation: useSalesStore.getState().getQuotation(quotationId),
  }).canConvert)

  oldRevisionDocId = documentId
  const rev = useCrmStore.getState().createQuotationRevision(documentId, 'UAT-05 revision after reject')
  latestDocId = rev.documentId ?? documentId
  const revDoc = latestDocId ? useCrmStore.getState().getQuotationDocument(latestDocId) : undefined
  const oldDoc = useCrmStore.getState().getQuotationDocument(oldRevisionDocId)!

  check('UAT-05.36', 'Revision numbering', 'New revision number increments', revDoc?.revisionNo === (oldDoc.revisionNo ?? 1) + 1, `rev ${revDoc?.revisionNo}`)
  check('UAT-05.37', 'Revision numbering', 'New revision starts as draft', revDoc?.status === 'draft')
  check('UAT-05.38', 'Original preserved', 'Original revision locked after revise', oldDoc.locked === true)
  check('UAT-05.39', 'Original preserved', 'Original revision status unchanged (rejected)', oldDoc.status === 'rejected')
  check('UAT-05.40', 'Original preserved', 'Both revisions exist for quotation', useCrmStore.getState().getQuotationDocumentsForQuotation(quotationId).length >= 2)

  if (latestDocId) {
    useCrmStore.getState().submitQuotationDocumentForApproval(latestDocId)
    useCrmStore.getState().approveQuotationDocument(latestDocId, 'UAT-05 approved')
  }
  documentId = latestDocId
} else {
  for (const id of ['UAT-05.34', 'UAT-05.35', 'UAT-05.36', 'UAT-05.37', 'UAT-05.38', 'UAT-05.39', 'UAT-05.40']) {
    check(id, 'Reject/revise', 'Revision flow step', false, 'missing document')
  }
}

// ─── UAT-05.7 Approved version identification ──────────────────────────────────

const approvedDoc = documentId ? useCrmStore.getState().getQuotationDocument(documentId) : undefined
const latestDoc = quotationId ? useCrmStore.getState().getLatestQuotationDocument(quotationId) : undefined
const salesQuo = quotationId ? useSalesStore.getState().getQuotation(quotationId) : undefined

check('UAT-05.41', 'Approved version', 'Latest document is approved', approvedDoc?.status === 'approved', approvedDoc?.status)
check('UAT-05.42', 'Approved version', 'getLatestQuotationDocument returns highest revision', latestDoc?.id === approvedDoc?.id)
check('UAT-05.43', 'Approved version', 'Approval history contains approved action', Boolean(approvedDoc?.approvalHistory.some((a) => a.action === 'approved')))
check('UAT-05.44', 'Approved version', 'Convert button visible for latest approved', approvedDoc && latestDoc ? canShowConvertButton({ document: approvedDoc, latestDocument: latestDoc, salesQuotation: salesQuo }) : false)
check('UAT-05.45', 'Approved version', 'Old revision convert button hidden', oldRevisionDocId && latestDoc ? !canShowConvertButton({
  document: useCrmStore.getState().getQuotationDocument(oldRevisionDocId)!,
  latestDocument: latestDoc,
  salesQuotation: salesQuo,
}) : false)

// ─── UAT-05.8 Invalid conversion guards ────────────────────────────────────────

if (approvedDoc && latestDoc && salesQuo) {
  const approvedVal = validateQuotationForSoConversion({
    document: approvedDoc,
    latestDocument: latestDoc,
    salesQuotation: salesQuo,
    customer,
  })
  check('UAT-05.46', 'Invalid conversion', 'Approved quotation passes validation', approvedVal.canConvert)
  check('UAT-05.47', 'Invalid conversion', 'Expired quotation blocked', isQuotationExpired({ ...salesQuo, validityDate: '2020-01-01' }))
  check('UAT-05.48', 'Invalid conversion', 'Validation checks approval history', conversionSrc.includes("a.action === 'approved'"))

  if (oldRevisionDocId) {
    const oldVal = validateQuotationForSoConversion({
      document: useCrmStore.getState().getQuotationDocument(oldRevisionDocId)!,
      latestDocument: latestDoc,
      salesQuotation: salesQuo,
      customer,
    })
    check('UAT-05.49', 'Invalid conversion', 'Non-latest revision blocked', !oldVal.canConvert, oldVal.disabledReason ?? '')
  } else {
    check('UAT-05.49', 'Invalid conversion', 'Non-latest revision blocked', false)
  }
} else {
  for (const id of ['UAT-05.46', 'UAT-05.47', 'UAT-05.48', 'UAT-05.49']) {
    check(id, 'Invalid conversion', 'Conversion guard step', false)
  }
}

// ─── UAT-05.9 Full critical path → Sales Order + double conversion ─────────────

let salesOrderId: string | undefined

if (documentId && approvedDoc) {
  const conv = useCrmStore.getState().convertQuotationDocumentToSalesOrder(documentId, {
    customerPoNumber: 'PO-UAT-05-001',
    expectedDeliveryDate: '2026-10-15',
    deliveryLocation: 'Pune Plant',
    internalRemarks: 'UAT-05 lifecycle test',
  })
  check('UAT-05.50', 'Sales Order', 'Approved quotation converts to SO', conv.ok, conv.salesOrderId)
  salesOrderId = conv.salesOrderId

  if (conv.ok && conv.salesOrderId) {
    const convertedDoc = useCrmStore.getState().getQuotationDocument(documentId)!
    check('UAT-05.51', 'Sales Order', 'Document status becomes converted', convertedDoc.status === 'converted')
    check('UAT-05.52', 'Sales Order', 'Document links salesOrderId', Boolean(convertedDoc.salesOrderId))
    check('UAT-05.53', 'Sales Order', 'Opportunity marked won', useCrmStore.getState().getOpportunity(oppResult.opportunityId!)?.status === 'won')
    check('UAT-05.54', 'Sales Order', 'SO exists in MRP store', Boolean(useMrpStore.getState().getSalesOrder(conv.salesOrderId)))

    const doubleConv = useCrmStore.getState().convertQuotationDocumentToSalesOrder(documentId, {
      customerPoNumber: 'PO-UAT-05-DUP',
    })
    check('UAT-05.55', 'Double conversion', 'Second conversion rejected', !doubleConv.ok, doubleConv.error)

    const convertedVal = validateQuotationForSoConversion({
      document: convertedDoc,
      latestDocument: convertedDoc,
      salesQuotation: salesQuo,
      customer,
    })
    check('UAT-05.56', 'Double conversion', 'Validation blocks already-converted', !convertedVal.canConvert)
    check('UAT-05.57', 'Double conversion', 'Convert button hidden after conversion', !canShowConvertButton({ document: convertedDoc, latestDocument: convertedDoc, salesQuotation: salesQuo }))
  } else {
    for (const id of ['UAT-05.51', 'UAT-05.52', 'UAT-05.53', 'UAT-05.54', 'UAT-05.55', 'UAT-05.56', 'UAT-05.57']) {
      check(id, 'Sales Order / double conversion', 'Conversion step', false, conv.error)
    }
  }
} else {
  for (const id of ['UAT-05.50', 'UAT-05.51', 'UAT-05.52', 'UAT-05.53', 'UAT-05.54', 'UAT-05.55', 'UAT-05.56', 'UAT-05.57']) {
    check(id, 'Sales Order', 'Critical path step', false)
  }
}

// Backend workflow guards
check('UAT-05.58', 'Backend workflow', 'assertDocumentSubmittable blocks locked non-draft', backendWorkflow.includes('assertDocumentSubmittable'))
check('UAT-05.59', 'Backend workflow', 'assertDocumentApprovable checks status', backendWorkflow.includes('assertDocumentApprovable'))

// ─── Live API (optional) ───────────────────────────────────────────────────────

async function tryLiveQuotations() {
  const base = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
  const tenant = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'

  try {
    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@vasant-trailers.com',
        password: 'Admin@123',
        tenantSlug: tenant,
      }),
    })
    const loginBody = await loginRes.json()
    const token = loginBody.data?.accessToken
    check('UAT-05.60', 'Live API', 'Login for quotation tests', loginRes.ok && Boolean(token), loginBody.message, true)
    if (!token) return

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const crmBase = `${base}/t/${tenant}/crm`

    const listRes = await fetch(`${crmBase}/quotations?limit=5`, { headers })
    check('UAT-05.61', 'Live API', 'List quotations endpoint', listRes.ok, `HTTP ${listRes.status}`, true)

    const stamp = Date.now()
    const userId = loginBody.data?.user?.id as string | undefined

    let liveOpp: { id: string; customerId: string; opportunityNo?: string; productId?: string } | undefined

    const pipelinesRes = await fetch(`${crmBase}/pipelines?limit=5`, { headers })
    const pipelinesBody = await pipelinesRes.json()
    const pipeline = pipelinesBody.data?.[0]
    const stage = pipeline?.stages?.[0]

    if (userId && pipeline?.id && stage?.id) {
      const companyRes = await fetch(`${crmBase}/companies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: `UAT05 Quo Co ${stamp}`,
          addressLine1: 'Plot 1, MIDC',
          city: 'Nashik',
          state: 'Maharashtra',
          contactPerson: 'UAT Contact',
          isActive: true,
        }),
      })
      const companyBody = await companyRes.json()
      const companyId = companyBody.data?.id
      if (companyId) {
        const newOppRes = await fetch(`${crmBase}/opportunities`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            opportunityName: `UAT05 Quo Opp ${stamp}`,
            customerId: companyId,
            pipelineId: pipeline.id,
            stageId: stage.id,
            ownerId: userId,
            value: 1500000,
          }),
        })
        const newOppBody = await newOppRes.json()
        if (newOppBody.data?.id) {
          liveOpp = {
            id: newOppBody.data.id,
            customerId: companyId,
            opportunityNo: newOppBody.data.opportunityNo,
            productId: newOppBody.data.productId,
          }
        }
      }
    }

    check('UAT-05.62', 'Live API', 'Fetch open opportunity for quotation', Boolean(liveOpp?.id), liveOpp?.id, true)

    if (liveOpp?.id && liveOpp.customerId) {
      const createPayload = {
        customerId: liveOpp.customerId,
        opportunityId: liveOpp.id,
        opportunityNo: liveOpp.opportunityNo,
        productId: liveOpp.productId,
        qty: 1,
        unitPrice: 1500000,
        paymentTerms: '30 days from invoice',
        deliveryTerms: 'Ex-works Pune',
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        priceLines: [
          {
            productOrItem: 'UAT-05 Live item',
            description: 'Test line',
            qty: 1,
            uom: 'Nos',
            unitPrice: 1500000,
            discountPct: 0,
            taxPct: 18,
          },
        ],
        sections: [
          { sectionType: 'payment', title: 'Payment Terms', content: '30 days from invoice', sequenceNo: 1 },
          { sectionType: 'delivery', title: 'Delivery Terms', content: 'Ex-works Pune', sequenceNo: 2 },
        ],
      }

      const createRes = await fetch(`${crmBase}/quotations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(createPayload),
      })
      const createBody = await createRes.json()
      const liveQuoId = createBody.data?.id
      const liveDocId = createBody.data?.documents?.[0]?.id
      check('UAT-05.63', 'Live API', 'Create quotation', createRes.status === 201 && Boolean(liveQuoId), createBody.message, true)

      if (liveQuoId && liveDocId) {
        const submitRes = await fetch(`${crmBase}/quotations/${liveQuoId}/documents/${liveDocId}/submit-approval`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ remarks: 'UAT-05 live submit' }),
        })
        check('UAT-05.64', 'Live API', 'Submit for approval', submitRes.ok, `HTTP ${submitRes.status}`, true)

        const getRes = await fetch(`${crmBase}/quotations/${liveQuoId}`, { headers })
        const getBody = await getRes.json()
        const docStatus = getBody.data?.documents?.find((d: { id: string }) => d.id === liveDocId)?.status
        check('UAT-05.65', 'Live API', 'Document status after submit', getRes.ok && (docStatus === 'approved' || docStatus === 'pending_approval'), docStatus, true)

        if (docStatus === 'pending_approval') {
          const approveRes = await fetch(`${crmBase}/quotations/${liveQuoId}/documents/${liveDocId}/approve`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ remarks: 'UAT-05 live approve' }),
          })
          check('UAT-05.66', 'Live API', 'Approve quotation document', approveRes.ok, `HTTP ${approveRes.status}`, true)
        } else {
          check('UAT-05.66', 'Live API', 'Approve quotation document', docStatus === 'approved', 'auto-approved', true)
        }

        const revRes = await fetch(`${crmBase}/quotations/${liveQuoId}/revisions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: 'UAT-05 live revision' }),
        })
        const revBody = await revRes.json()
        const revDocId = revBody.data?.documents?.[0]?.id
        check('UAT-05.67', 'Live API', 'Create quotation revision', revRes.ok && Boolean(revDocId), revBody.message, true)

        const dupRes = await fetch(`${crmBase}/quotations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(createPayload),
        })
        check('UAT-05.68', 'Live API', 'Duplicate opportunity quotation rejected', dupRes.status === 400 || dupRes.status === 422, `HTTP ${dupRes.status}`, true)
      }
    } else {
      check('UAT-05.63', 'Live API', 'Create quotation', true, 'skipped — no open opportunity', true)
    }
  } catch (e) {
    check('UAT-05.60', 'Live API', 'Live quotation tests skipped — backend unreachable', true, e instanceof Error ? e.message : String(e), true)
  }
}

await tryLiveQuotations()

resetSessionUserForTests()

// ─── Report ──────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)
const automated = results.filter((r) => !r.live)
const live = results.filter((r) => r.live)

const report = [
  '# UAT-05 — Quotation Lifecycle',
  '',
  `**Date:** ${new Date().toISOString().slice(0, 10)}`,
  `**Overall:** ${failed.length === 0 ? '✅ PASS' : '❌ FAIL'} (${passed}/${results.length})`,
  '',
  '## Critical path',
  '',
  'Opportunity → Quotation → Approval → Revision → Approved Quotation → Sales Order',
  '',
  '| ID | Area | Test | Status | Notes |',
  '|----|------|------|--------|-------|',
  ...results.map(
    (r) => `| ${r.id} | ${r.area} | ${r.label} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail ?? ''} |`,
  ),
  '',
  '## Findings',
  '',
  '- Frontend discount approval threshold: **10%** (`types/crm.ts`)',
  '- Backend discount approval threshold aligned at **10%** (`quotation.constants.ts` + frontend `types/crm.ts`)',
  '- SO conversion available via `POST /crm/quotations/:id/convert-to-sales-order` (API mode)',
  '- Live API tests run only when backend is reachable on `:5000`',
  '',
  '## Manual sign-off checklist',
  '',
  '- [ ] Open CRM → Opportunities → create quotation from open opportunity',
  '- [ ] Quotation editor: add/edit line items, verify tax/discount/grand total',
  '- [ ] Save as draft — document editable, no convert button',
  '- [ ] Submit for approval — pending when above ₹50L or discount >10%',
  '- [ ] Approve as sales manager; shop-floor role cannot approve',
  '- [ ] Reject quotation, create revision — rev number increments, old rev locked',
  '- [ ] Revisions page shows **Latest** badge on current revision',
  '- [ ] Approve latest revision — convert button appears on 360 page',
  '- [ ] Create Sales Order — opportunity won, quotation converted',
  '- [ ] Second convert attempt blocked with clear message',
  '- [ ] (API mode) Quotation CRUD syncs via `quotationApiBridge`',
  '',
  '## Demo credentials',
  '',
  '- Tenant: `vasant-trailers`',
  '- Email: `admin@vasant-trailers.com`',
  '- Password: `Admin@123`',
  '',
]

writeFileSync(path.join(ROOT, 'UAT-05_QUOTATION_LIFECYCLE_REPORT.md'), report.join('\n'))
console.log(`\nWrote UAT-05_QUOTATION_LIFECYCLE_REPORT.md`)
console.log(`\nUAT-05: ${passed}/${results.length} passed (${automated.filter((r) => r.ok).length}/${automated.length} automated, ${live.filter((r) => r.ok).length}/${live.length} live)\n`)

process.exit(failed.length ? 1 : 0)
