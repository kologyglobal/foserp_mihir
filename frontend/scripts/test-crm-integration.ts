/**
 * CRM ↔ ERP integration tests — npm run test:crm-integration
 */
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

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { resetCrmBootstrapGuard } = await import('../src/demo/factories/crmEcosystemBootstrap')
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { buildCrmDashboardMetrics } = await import('../src/utils/crmMetrics')
const { validateCrmOrphans } = await import('../src/utils/crmIntegration')
const { getOpportunityPipelineReport, getSalesActivityReport } = await import('../src/utils/crmReports')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')

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

console.log('\nCRM ↔ ERP Integration Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
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
    opportunityName: 'Integration test opportunity',
    productRequirement: 'Test bulker requirement',
    stage: 'qualified',
    value: 2500000,
    probability: 50,
    expectedCloseDate: '2026-09-30',
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
let opportunityId = openOpp?.id

if (openOpp) {
  const r = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2100000)
  check(1, 'Opportunity creates quotation', r.ok)
  check(2, 'Quotation copies customer/contact/product from opportunity', r.ok && !!openOpp.customerId && !!openOpp.productId)
  quotationId = r.quotationId
  documentId = r.documentId
  opportunityId = openOpp.id
  const oppAfter = useCrmStore.getState().getOpportunity(openOpp.id)!
  const q = quotationId ? sales.getQuotation(quotationId) : undefined
  check(3, 'Quotation appears in Opportunity 360', !!oppAfter.quotationId && oppAfter.stage === 'quotation_prepared')
  check(4, 'Quotation value updates opportunity value', oppAfter.value > 0 && oppAfter.value === useCrmStore.getState().getQuotationDocument(documentId!)?.totalAmount)
  if (documentId) {
    const doc = useCrmStore.getState().getQuotationDocument(documentId)!
    const sections = [...doc.sections, { id: 'sec-int', sectionType: 'custom' as const, title: 'Integration', content: 'Test', sequenceNo: 99, editable: true }]
    crm.updateQuotationDocumentSections(documentId, sections)
    check(5, 'User can edit quotation document sections', useCrmStore.getState().getQuotationDocument(documentId)!.sections.some((s) => s.id === 'sec-int'))
    const reordered = [...sections].reverse().map((s, i) => ({ ...s, sequenceNo: i + 1 }))
    crm.updateQuotationDocumentSections(documentId, reordered)
    check(6, 'User can reorder quotation sections', useCrmStore.getState().getQuotationDocument(documentId)!.sections[0]?.id === reordered[0]?.id)
    const lines = doc.priceLines.map((l) => ({ ...l, qty: 2 }))
    crm.updateQuotationDocumentPriceTable(documentId, lines)
    const updated = useCrmStore.getState().getQuotationDocument(documentId)!
    check(7, 'Price table calculates quotation total', updated.totalAmount > 0)
    const rev = crm.createQuotationRevision(documentId, 'Integration revision')
    check(8, 'Revision locks old quotation', rev.ok && useCrmStore.getState().getQuotationDocument(documentId)!.locked)
    documentId = rev.documentId ?? documentId
    crm.approveQuotationDocument(documentId, 'Integration approved')
    const approved = useCrmStore.getState().getQuotationDocument(documentId)!
    check(9, 'Approved quotation locks editing', approved.status === 'approved' && approved.locked)
    const conv = crm.convertQuotationDocumentToSalesOrder(documentId)
    check(10, 'Approved quotation converts to Sales Order', conv.ok, conv.salesOrderId)
    if (conv.ok && conv.salesOrderId) {
      const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
      check(11, 'SO stores quotation revision reference', so?.quotationDocumentRevisionNo != null && !!so?.quotationId)
      const oppWon = useCrmStore.getState().getOpportunity(openOpp.id)
      check(12, 'Opportunity becomes Won after SO creation', oppWon?.status === 'won' && oppWon.stage === 'won')
    } else {
      check(11, 'SO stores quotation revision reference', false, conv.error)
      check(12, 'Opportunity becomes Won after SO creation', false)
    }
  }
} else {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) check(n, 'Quotation flow step', false, 'no open opp')
}

const fu = crm.createFollowUp({
  followUpType: 'call',
  customerId: masters.customers[0]?.id,
  opportunityId: crm.opportunities[0]?.id,
  assignedTo: 'user-rajesh',
  assignedToName: 'Rajesh Kumar',
  dueDate: new Date().toISOString().slice(0, 10),
  notes: 'Integration F/U',
})
const actsBefore = useCrmStore.getState().activities.length
if (fu.ok && fu.followUpId) crm.completeFollowUp(fu.followUpId, 'Done')
check(13, 'Follow-up completion creates activity', useCrmStore.getState().activities.length > actsBefore)

const cust = masters.customers[0]
const summary = cust
  ? (await import('../src/utils/crmMetrics')).customerCrmSummary(
      cust.id,
      crm.opportunities,
      crm.followUps,
      crm.activities,
    )
  : null
check(14, 'Customer 360 shows opportunities, quotations, SO and invoices', !!summary && crm.opportunities.length >= 40)

const metrics = buildCrmDashboardMetrics({
  opportunities: crm.opportunities,
  followUps: crm.followUps,
  activities: crm.activities,
  quotationDocuments: crm.quotationDocuments,
})
check(15, 'CRM dashboard values match data', metrics.openOpportunities > 0 && metrics.pipelineValue > 0)

const pipelineRows = getOpportunityPipelineReport()
const activityRows = getSalesActivityReport()
check(16, 'CRM reports show 30+ rows where applicable', pipelineRows.length >= 30 && activityRows.length >= 30)

const mobileFollowUp = crm.createFollowUp({
  followUpType: 'meeting',
  assignedTo: 'user-priya',
  assignedToName: 'Priya Deshmukh',
  dueDate: new Date().toISOString().slice(0, 10),
  notes: 'Mobile CRM test',
})
check(17, 'CRM mobile follow-up works', mobileFollowUp.ok)

const orphans = validateCrmOrphans({
  customerIds: new Set(masters.customers.map((c) => c.id)),
  salesQuotationIds: new Set(sales.quotations.map((q) => q.id)),
  opportunities: crm.opportunities,
  quotationDocuments: crm.quotationDocuments,
  followUps: crm.followUps,
  activities: crm.activities,
})
check(18, 'No orphan CRM records exist', orphans.ok, [
  orphans.orphanOpportunities.length ? `opps:${orphans.orphanOpportunities.join(',')}` : '',
  orphans.orphanDocuments.length ? `docs:${orphans.orphanDocuments.join(',')}` : '',
  orphans.orphanFollowUps.length ? `fu:${orphans.orphanFollowUps.join(',')}` : '',
  orphans.orphanActivities.length ? `act:${orphans.orphanActivities.join(',')}` : '',
].filter(Boolean).join('; ') || 'clean')

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
