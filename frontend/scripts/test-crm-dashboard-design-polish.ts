/**
 * CRM Dashboard Design Polish tests — npm run test:crm-dashboard-design-polish
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
const { useMasterStore } = await import('../src/store/masterStore')
const { buildCrmDashboardMetrics, sortFollowUpsByUrgency } = await import('../src/utils/crmMetrics')
const { buildCrmNextActions } = await import('../src/utils/crmNextActions')
const { buildStuckOpportunityInsights } = await import('../src/utils/crmStuckAnalysis')
const {
  getAvailableCrmViewModes,
  getDefaultCrmViewMode,
  filterOpportunitiesByView,
} = await import('../src/utils/crmDashboardAccess')
const { CRM_EXTENSION_CUSTOMERS } = await import('../src/data/crm/crmSampleSeed')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { runPackageScript } = await import('./run-package-script')

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

function readSrc(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM Dashboard Design Polish Tests\n')
resetDemoBaseline()
setSessionUserForTests({ role: 'ceo', experienceRole: 'ceo' })

const crm = useCrmStore.getState()
const customers = useMasterStore.getState().customers

const metrics = buildCrmDashboardMetrics({
  opportunities: crm.opportunities,
  followUps: crm.followUps,
  activities: crm.activities,
  quotationDocuments: crm.quotationDocuments,
})

const pageSrc = readSrc('src/modules/crm/CrmDashboardPage.tsx')
const cssSrc = readSrc('src/styles/dynamics-components.css')
const navSrc = readSrc('src/config/navigation.ts')
const pkg = readFileSync(path.join(ROOT, 'package.json'), 'utf8')
const ci = readFileSync(path.join(ROOT, 'scripts/run-ci.ts'), 'utf8')

check(1, 'Dashboard metrics build without crash', metrics.pipelineValue > 0)
check(2, 'KPI cards use live CRM pipeline data', metrics.openOpportunities > 0 && metrics.weightedForecast > 0)
check(3, 'KPI typography tokens in CSS', cssSrc.includes('.crm-kpi-label') && cssSrc.includes('.crm-kpi-value'))
check(4, 'Pipeline health board component exists', readSrc('src/components/crm/CrmPipelineHealthBoard.tsx').includes('crm-pipeline-stage-scroll'))
check(5, 'No dark neon pipeline hero on dashboard page', !pageSrc.includes('CrmPipelineFunnel') && pageSrc.includes('CrmPipelineHealthBoard'))
check(24, 'Dashboard includes graphical charts', pageSrc.includes('CrmPipelineValueChart') && pageSrc.includes('CrmDealOutcomesChart'))
check(6, 'Follow-ups sorted by urgency', (() => {
  const sorted = sortFollowUpsByUrgency(crm.followUps.filter((f) => f.status === 'overdue' || f.status === 'pending'))
  if (sorted.length < 2) return true
  const overdueIdx = sorted.findIndex((f) => f.status === 'overdue')
  const pendingIdx = sorted.findIndex((f) => f.status === 'pending')
  if (overdueIdx === -1 || pendingIdx === -1) return true
  return overdueIdx < pendingIdx
})())
check(7, 'Next best actions have priority and CTA', (() => {
  const actions = buildCrmNextActions(5)
  return actions.length > 0 && actions.every((a) => a.priority && a.actionLabel && a.reason)
})())
check(8, 'Hot opportunities include value and stage data', metrics.hotOpportunities.length > 0 && metrics.hotOpportunities.every((o) => o.value > 0 && o.stage))
check(9, 'Stuck opportunities show risk reasons', (() => {
  const insights = buildStuckOpportunityInsights(crm.opportunities.filter((o) => o.status === 'open'))
  return insights.length === 0 || insights.every((i) => i.riskReason.length > 5)
})())
check(10, 'Quotation approval panel data available', metrics.pendingApprovalQuotations.every((d) => d.totalAmount > 0))
check(11, 'Grouped activity timeline component exists', readSrc('src/components/crm/GroupedActivityTimeline.tsx').includes('Today'))
check(12, 'Recently won includes ERP next step helper', readSrc('src/utils/crmMetrics.ts').includes('getWonDealNextErpStep'))
check(13, 'CRM navigation labels consistent', navSrc.includes("label: 'Companies'") && navSrc.includes("label: 'Opportunities'") && !navSrc.includes("label: 'Follow-ups', path: '/crm/follow-ups'"))
check(14, 'Demo customers use realistic names', !CRM_EXTENSION_CUSTOMERS.some((c) => c.customerName.includes('CRM Demo Customer')) && CRM_EXTENSION_CUSTOMERS.some((c) => c.customerName.includes('Cement')))
check(15, 'CEO/Manager/My CRM view switch on dashboard', pageSrc.includes('crm-view-switch') && pageSrc.includes('getAvailableCrmViewModes'))
check(16, 'Dashboard uses design system components', pageSrc.includes('ErpButton') && !pageSrc.includes('ErpPageGuide') && pageSrc.includes('DynamicsModuleDashboard'))
check(17, 'Empty state patterns in panels', readSrc('src/components/crm/CrmDashboardPanels.tsx').includes('crm-empty-state'))
check(18, 'Responsive rules at 1366px', cssSrc.includes('@media (max-width: 1366px)'))
check(19, 'View mode filtering works', filterOpportunitiesByView(crm.opportunities, 'ceo').length >= filterOpportunitiesByView(crm.opportunities, 'my').length)
check(20, 'Default view mode for CEO is ceo', getDefaultCrmViewMode('ceo') === 'ceo' && getAvailableCrmViewModes('sales').length === 1)

const advancedCrm = runPackageScript('test:advanced-crm', ROOT)
check(21, 'Existing advanced CRM tests pass', advancedCrm.status === 0)
check(22, 'Design polish test wired into package.json', pkg.includes('test:crm-dashboard-design-polish'))
check(23, 'Design polish test wired into CI', ci.includes('test:crm-dashboard-design-polish'))

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
