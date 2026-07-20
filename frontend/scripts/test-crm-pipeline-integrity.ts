/**
 * CRM pipeline integrity — npm run test:crm-pipeline-integrity
 * P1: lead ↔ opportunity hard links; quotations created from opportunities (no inquiry step).
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

console.log('\nCRM Pipeline Integrity Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const crm = useCrmStore.getState()
const sales = useSalesStore.getState()
const masters = useMasterStore.getState()
const customer = masters.customers[0]
const productId = masters.products[0]?.id ?? 'prod-45m3'

// Demo seed linkage (first 30 pipeline rows)
const demoLead = sales.leads.find((l) => l.id === 'lead-demo-0001')
const demoOpp = crm.opportunities.find((o) => o.id === 'opp-crm-001')
check(1, 'Demo lead links to opportunity', Boolean(demoLead?.opportunityId === 'opp-crm-001'))
check(2, 'Demo opportunity links to lead', demoOpp?.leadId === 'lead-demo-0001')

const leadR = sales.createLead({
  prospectName: 'Pipeline Integrity Lead',
  customerId: customer?.id ?? 'cust-abc',
  leadOwnerId: 'user-rajesh',
  leadOwnerName: 'Rajesh Kumar',
  expectedValue: 2500000,
  priority: 'high',
  createdDate: new Date().toISOString().slice(0, 10),
  activityStatus: 'active',
  lifecycleStatus: 'open',
  stage: 'new',
  productRequirement: 'Integrity test bulker',
  source: 'referral',
  industry: 'Cement',
  probability: 50,
})
check(3, 'Test lead created', leadR.ok, leadR.leadId)

if (leadR.ok && leadR.leadId) {
  sales.advanceLeadStage(leadR.leadId, 'contacted')
  sales.advanceLeadStage(leadR.leadId, 'qualified')

  const oppBefore = useCrmStore.getState().opportunities.length
  const oppR = crm.createOpportunity({
    customerId: customer?.id ?? 'cust-abc',
    contactId: null,
    productId,
    opportunityName: 'Pipeline Integrity Deal',
    productRequirement: 'Integrity test bulker',
    lines: [],
    stage: 'qualified',
    value: 2500000,
    probability: 60,
    expectedCloseDate: '2026-10-15',
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    priority: 'high',
    status: 'open',
    lostReason: null,
    leadId: leadR.leadId,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    nextFollowUpDate: null,
  })
  check(4, 'Opportunity created from lead', oppR.ok, oppR.opportunityId)
  check(5, 'Exactly one opportunity created for lead path', useCrmStore.getState().opportunities.length === oppBefore + 1)

  const linkedLead = useSalesStore.getState().getLead(leadR.leadId)
  const linkedOpp = oppR.opportunityId ? useCrmStore.getState().getOpportunity(oppR.opportunityId) : undefined
  check(6, 'Lead stores opportunityId', linkedLead?.opportunityId === oppR.opportunityId)
  check(7, 'Opportunity stores leadId', linkedOpp?.leadId === leadR.leadId)
  check(8, 'Lead convertLeadToInquiry is disabled', !sales.convertLeadToInquiry(leadR.leadId, productId, 2, '2026-10-01').ok)

  if (oppR.ok && oppR.opportunityId) {
    const quoR = crm.createQuotationFromOpportunity(oppR.opportunityId, 'qtpl-iso-tank', 2100000)
    check(9, 'Quotation created from opportunity', quoR.ok, quoR.quotationId)

    const quo = quoR.quotationId ? useSalesStore.getState().getQuotation(quoR.quotationId) : undefined
    check(10, 'Quotation links opportunity', quo?.opportunityId === oppR.opportunityId)
    check(11, 'Quotation has no inquiryId requirement', quo != null && !quo.inquiryId)
    check(12, 'Opportunity updated with quotation link', useCrmStore.getState().getOpportunity(oppR.opportunityId)?.quotationId === quoR.quotationId)
  }
} else {
  for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) check(n, 'Lead pipeline step', false, 'lead create failed')
}

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
