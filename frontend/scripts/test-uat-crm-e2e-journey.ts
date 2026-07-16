/**
 * CRM E2E business journeys (demo mode)
 * Run: npm run test:uat-crm-e2e-journey
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
const { setSessionUserForTests } = await import('../src/utils/permissions')
const { resolveStoreAction } = await import('../src/store/storeAction')

interface JourneyResult {
  journey: string
  ok: boolean
  detail?: string
}

const results: JourneyResult[] = []

function journey(name: string, ok: boolean, detail = '') {
  results.push({ journey: name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function makeOpp(custId: string, name: string, leadId?: string) {
  return useCrmStore.getState().createOpportunity({
    customerId: custId,
    contactId: null,
    productId: 'prod-45m3',
    opportunityName: name,
    productRequirement: 'E2E requirement',
    stage: 'qualified',
    value: 1200000,
    probability: 50,
    expectedCloseDate: '2026-12-31',
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    priority: 'medium',
    status: 'open',
    lostReason: null,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    leadId: leadId ?? null,
    locationId: null,
    lines: [],
  })
}

console.log('\nCRM E2E Business Journeys (demo mode)\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const cust = useMasterStore.getState().customers[0]

// Journey A: Lead → stage → follow-up → convert opportunity
{
  const leadRes = useSalesStore.getState().createLead({
    prospectName: 'E2E Journey A Prospect',
    customerId: cust.id,
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    stage: 'new',
    priority: 'medium',
    leadSource: 'website',
    followUpType: 'call',
    locationId: null,
    industry: 'Manufacturing',
    expectedValue: 500000,
    notes: 'E2E journey A',
    lifecycleStatus: 'open',
    activityStatus: 'active',
  })
  const leadId = leadRes.leadId!
  const stageMove = useSalesStore.getState().advanceLeadStage(leadId, 'contacted')
  const fu = useCrmStore.getState().createFollowUp({
    followUpType: 'call',
    leadId,
    customerId: cust.id,
    assignedTo: 'user-rajesh',
    assignedToName: 'Rajesh Kumar',
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '11:00',
    priority: 'medium',
    notes: 'Journey A follow-up',
    reminder: true,
  })
  useSalesStore.getState().advanceLeadStage(leadId, 'qualified')
  const conv = makeOpp(cust.id, 'E2E Journey A Opportunity', leadId)
  const linkedLead = useSalesStore.getState().getLead(leadId)
  journey(
    'A: Lead → stage → follow-up → convert opportunity',
    Boolean(leadRes.leadId) && stageMove.ok && fu.ok && conv.ok && linkedLead?.stage === 'converted_to_opportunity',
    conv.opportunityId,
  )
}

// Journey B: Opportunity → activity → follow-up → pipeline stage
{
  const oppRes = makeOpp(cust.id, 'E2E Journey B Opportunity')
  const oppId = oppRes.opportunityId!
  const act = useCrmStore.getState().createActivity({
    type: 'call',
    subject: 'E2E Journey B call',
    customerId: cust.id,
    opportunityId: oppId,
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
  })
  const fu = useCrmStore.getState().createFollowUp({
    followUpType: 'meeting',
    customerId: cust.id,
    opportunityId: oppId,
    assignedTo: 'user-rajesh',
    assignedToName: 'Rajesh Kumar',
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '14:00',
    priority: 'high',
    notes: 'Journey B follow-up',
    reminder: true,
  })
  const move = useCrmStore.getState().moveOpportunityStage({ opportunityId: oppId, stage: 'negotiation' })
  journey(
    'B: Opportunity → activity → follow-up → pipeline stage',
    oppRes.ok && act.ok && fu.ok && move.ok,
    'negotiation',
  )
}

// Journey C: Opportunity → quotation → approval → revision
{
  const oppRes = makeOpp(cust.id, 'E2E Journey C Opportunity')
  const quo = useCrmStore.getState().createQuotationFromOpportunity(oppRes.opportunityId!, 'qtpl-standard-trailer', 1200000)
  const docId = quo.documentId
  const submit = docId ? useCrmStore.getState().submitQuotationDocumentForApproval(docId) : { ok: false }
  const approve = docId ? useCrmStore.getState().approveQuotationDocument(docId) : { ok: false }
  const revise = docId ? useCrmStore.getState().createQuotationRevision(docId, 'E2E revision') : { ok: false }
  journey(
    'C: Opportunity → quotation → approval → revision',
    oppRes.ok && quo.ok && submit.ok && approve.ok && revise.ok,
    quo.quotationId,
  )
}

// Journey D: Approved quotation → SO conversion → persistence
{
  const oppRes = makeOpp(cust.id, 'E2E Journey D Opportunity')
  const quo = useCrmStore.getState().createQuotationFromOpportunity(oppRes.opportunityId!, 'qtpl-standard-trailer', 1200000)
  const docId = quo.documentId!
  useCrmStore.getState().submitQuotationDocumentForApproval(docId)
  useCrmStore.getState().approveQuotationDocument(docId)
  const conv = useCrmStore.getState().convertQuotationDocumentToSalesOrder(docId, {
    customerPoNumber: 'PO-E2E-001',
    expectedDeliveryDate: '2026-11-01',
  })
  const persistedDoc = useCrmStore.getState().getQuotationDocument(docId)
  const so = conv.salesOrderId ? useMrpStore.getState().getSalesOrder(conv.salesOrderId) : undefined
  journey(
    'D: Approved quotation → SO → persistence',
    conv.ok && persistedDoc?.status === 'converted' && Boolean(so?.id),
    conv.salesOrderNo,
  )
}

// Journey E: New master → CRM dropdown → save → refresh
{
  const before = useMasterStore.getState().customers.length
  const createdId = useMasterStore.getState().addCustomer({
    customerName: `E2E Master Co ${Date.now()}`,
    addressLine1: 'Test Address',
    city: 'Pune',
    state: 'Maharashtra',
    contactPerson: 'E2E Contact',
    isActive: true,
  }) as string
  const after = useMasterStore.getState().customers.length
  const found = useMasterStore.getState().customers.some((c) => c.id === createdId)
  journey('E: New master → appears in CRM dropdown', Boolean(createdId) && after > before && found, createdId)
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)
console.log(`\nJourneys: ${passed}/${results.length} passed\n`)
process.exit(failed.length ? 1 : 0)
