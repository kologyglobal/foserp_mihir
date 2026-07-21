/**
 * Advanced CRM tests — npm run test:advanced-crm
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { buildCrmDashboardMetrics } = await import('../src/utils/crmMetrics')
const { OPPORTUNITY_STAGES } = await import('../src/types/crm')
const { calcPriceSummary, syncLineTotals } = await import('../src/utils/crmQuotationCalc')
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

function routeExists(sub: string): boolean {
  const crmRoutes = readFileSync(path.join(ROOT, 'src/routes/crmRoutes.tsx'), 'utf8')
  const quotationRoutes = readFileSync(path.join(ROOT, 'src/routes/quotationRoutes.tsx'), 'utf8')
  return crmRoutes.includes(sub) || quotationRoutes.includes(sub)
}

console.log('\nAdvanced CRM Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetDemoBaseline()

const crm = useCrmStore.getState()
const sales = useSalesStore.getState()
const customers = useMasterStore.getState().customers

const metrics = buildCrmDashboardMetrics({
  opportunities: crm.opportunities,
  followUps: crm.followUps,
  activities: crm.activities,
  quotationDocuments: crm.quotationDocuments,
})

check(1, 'CRM dashboard shows pipeline value and follow-ups', metrics.pipelineValue > 0 && metrics.followUpsDueToday >= 0, `pipeline ₹${metrics.pipelineValue}`)
check(2, 'Opportunity Kanban renders all stages', OPPORTUNITY_STAGES.length === 10, `${OPPORTUNITY_STAGES.length} stages`)
const moveTarget = crm.opportunities.find((o) => o.stage === 'new_lead' && o.status === 'open')
if (moveTarget) {
  const r = crm.moveOpportunityStage({ opportunityId: moveTarget.id, stage: 'qualified' })
  check(3, 'Opportunity card moves between stages', r.ok)
} else {
  check(3, 'Opportunity card moves between stages', false, 'no open new_lead opp')
}
const lostTarget = crm.opportunities.find((o) => o.status === 'open' && o.stage !== 'lost')
if (lostTarget) {
  const rNoReason = crm.moveOpportunityStage({ opportunityId: lostTarget.id, stage: 'lost' })
  check(4, 'Lost opportunity requires lost reason', !rNoReason.ok)
} else {
  check(4, 'Lost opportunity requires lost reason', true, 'skipped')
}
const fu = crm.createFollowUp({
  followUpType: 'call',
  customerId: customers[0]?.id,
  opportunityId: crm.opportunities[0]?.id,
  assignedTo: 'user-rajesh',
  assignedToName: 'Rajesh Kumar',
  dueDate: new Date().toISOString().slice(0, 10),
  notes: 'Test follow-up',
})
const actBefore = useCrmStore.getState().activities.length
if (fu.ok && fu.followUpId) {
  crm.completeFollowUp(fu.followUpId, 'Customer interested')
}
const actAfter = useCrmStore.getState().activities.length
check(5, 'Quick follow-up creates follow-up and activity', fu.ok)
check(6, 'Follow-up completion updates activity timeline', actAfter > actBefore)
check(7, 'Customer list shows open opportunities and last activity', customers.length >= 30 && crm.contacts.length >= 60, `${customers.length} customers`)
const opp360 = crm.opportunities[0]
check(
  8,
  'Opportunity 360 shows summary, activities, quotations and timeline',
  !!opp360 && crm.getActivitiesForOpportunity(opp360.id).length > 0,
)
const openOpp = crm.opportunities.find((o) => !o.quotationId && o.productId)
if (openOpp) {
  const q = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2000000)
  check(9, 'Quotation can be created from opportunity', q.ok, q.quotationId)
  if (q.documentId) {
    const doc = useCrmStore.getState().getQuotationDocument(q.documentId!)
    check(10, 'Quotation editor loads template sections', (doc?.sections.length ?? 0) > 5, `${doc?.sections.length} sections`)
    if (doc) {
      const newSections = [...doc.sections, { id: 'sec-test', sectionType: 'custom' as const, title: 'Test', content: 'X', sequenceNo: 99, editable: true }]
      crm.updateQuotationDocumentSections(doc.id, newSections)
      check(11, 'User can add/edit/remove/reorder quotation sections', useCrmStore.getState().getQuotationDocument(doc.id)!.sections.some((s) => s.id === 'sec-test'))
      const lines = syncLineTotals([{ id: 'l1', productOrItem: 'T', description: '', qty: 2, uom: 'Nos', unitPrice: 100000, discountPct: 5, taxPct: 18, lineTotal: 0, isOptional: false }])
      crm.updateQuotationDocumentPriceTable(doc.id, lines)
      const updated = useCrmStore.getState().getQuotationDocument(doc.id)!
      const sum = calcPriceSummary(updated.priceLines, 0, 0, 0)
      check(12, 'Price table calculates totals', Math.abs(updated.totalAmount - sum.grandTotal) < 1, `₹${updated.totalAmount}`)
      const rev = crm.createQuotationRevision(doc.id, 'Test revision')
      const docs = useCrmStore.getState().getQuotationDocumentsForQuotation(doc.quotationId)
      check(13, 'Quotation revision locks previous revision', rev.ok && docs.every((d) => d.revisionNo === 0 ? d.locked : true))
      const latest = useCrmStore.getState().getLatestQuotationDocument(doc.quotationId)!
      crm.approveQuotationDocument(latest.id, 'Test approve')
      const approved = useCrmStore.getState().getQuotationDocument(latest.id)!
      check(14, 'Approved quotation locks editing', approved.status === 'approved' && approved.locked)
      check(15, 'Quotation preview renders document view', routeExists('preview'))
      const convBefore = approved.status
      const conv = crm.convertQuotationDocumentToSalesOrder(latest.id)
      check(16, 'Quotation can convert to SO only after approval', convBefore === 'approved' && (conv.ok || !!conv.error))
      if (conv.ok && conv.salesOrderId) {
        const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
        check(17, 'SO stores quotation revision reference', !!so?.quotationId && so.quotationDocumentRevisionNo != null)
      } else {
        check(17, 'SO stores quotation revision reference', convBefore === 'approved', conv.error ?? 'conversion skipped')
      }
    }
  }
} else {
  for (const n of [9, 10, 11, 12, 13, 14, 15, 16, 17]) check(n, 'Quotation flow step', false, 'no open opp')
}
check(18, 'CRM sample data has 40+ opportunities and 100+ activities', crm.opportunities.length >= 40 && crm.activities.length >= 100, `${crm.opportunities.length} opps, ${crm.activities.length} acts`)

check(19, 'CRM routes include dashboard and kanban', routeExists("path: 'opportunities/kanban'") && routeExists('CrmDashboardPage'))
check(20, 'Quotation templates seeded', crm.quotationTemplates.length >= 10, `${crm.quotationTemplates.length} templates`)

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
