/**
 * CRM Companies UI/UX tests — npm run test:crm-companies-ui
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
const { useMrpStore } = await import('../src/store/mrpStore')
const { resolvePageGuide } = await import('../src/config/pageGuideRegistry')
const { CRM_EXTENSION_CUSTOMERS } = await import('../src/data/crm/crmSampleSeed')
const {
  buildEnrichedCompanyRows,
  buildCompanyPortfolioKpis,
  filterCompanyRows,
  sortCompanyRows,
  DEFAULT_COMPANY_FILTERS,
} = await import('../src/utils/crmCompaniesPortfolio')
const { resolveCrmCompanyStatus } = await import('../src/utils/crmCompanyStatus')
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

console.log('\nCRM Companies UI/UX Tests\n')
resetDemoBaseline()

const pageSrc = readSrc('src/modules/crm/CrmEntityPages.tsx')
const cardSrc = readSrc('src/components/erp/ErpCompanyCard.tsx')
const tableSrc = readSrc('src/components/crm/CrmCompaniesTable.tsx')
const chromeSrc = readSrc('src/components/layout/DynamicsWorkspaceChrome.tsx')
const navSrc = readSrc('src/config/navigation.ts')
const cssSrc = readSrc('src/styles/dynamics-components.css')
const pkg = readFileSync(path.join(ROOT, 'package.json'), 'utf8')
const ci = readFileSync(path.join(ROOT, 'scripts/run-ci.ts'), 'utf8')
const uat = readFileSync(path.join(ROOT, 'scripts/test-uat.ts'), 'utf8')
const eeta = readFileSync(path.join(ROOT, 'scripts/test-eeta-100.ts'), 'utf8')
const fullUat = readFileSync(path.join(ROOT, 'scripts/test-full-system-uat.ts'), 'utf8')

const crm = useCrmStore.getState()
const customers = useMasterStore.getState().customers
const salesOrders = useMrpStore.getState().salesOrders

const rows = buildEnrichedCompanyRows({
  customers,
  contacts: crm.contacts,
  opportunities: crm.opportunities,
  followUps: crm.followUps,
  activities: crm.activities,
  quotationDocuments: crm.quotationDocuments,
  salesOrders,
  receivables: [],
})

const kpis = buildCompanyPortfolioKpis(rows)
const filtered = filterCompanyRows(rows, { ...DEFAULT_COMPANY_FILTERS, overdueFollowUp: true })
const sorted = sortCompanyRows(rows, 'pipeline')

check(1, 'CRM Companies page module loads', pageSrc.includes('export function CrmCustomersPage'))
check(2, 'Navigation CRM tab order: Companies before Leads', (() => {
  const idxCompanies = navSrc.indexOf("label: 'Companies'")
  const idxLeads = navSrc.indexOf("label: 'Leads'")
  return idxCompanies > 0 && idxCompanies < idxLeads
})())
check(3, 'Workspace chrome uses module tabs (no Zoho vertical rail)', chromeSrc.includes('DynamicsTabs') && chromeSrc.includes('useModuleTabs') && !chromeSrc.includes('ModuleSubNavRail'))
const { readAllRouteSources } = await import('./routeSource')
check(3.1, 'entity360 customer route registered', readAllRouteSources(ROOT).includes("path: 'entity360/customers/:id'"))
check(4, 'KPI cards calculate from company data', kpis.totalCompanies >= 20 && kpis.pipelineValue >= 0)
check(5, 'Filters work (overdue)', filtered.every((r) => r.summary.hasOverdueFollowUp) || filtered.length === 0)
check(6, 'Sort works (pipeline desc)', sorted[0].summary.pipelineValue >= sorted[sorted.length - 1]?.summary.pipelineValue)
check(7, 'Register table has 20+ company rows', rows.length >= 20, `${rows.length} companies`)
check(8, 'Table view uses enterprise register shell', pageSrc.includes('EnterpriseRegisterTableShell') && pageSrc.includes('CrmCompaniesTable') && tableSrc.includes('registerBar'))
check(9, 'Company cards still available for portfolio widgets', cardSrc.includes('DynamicsStatusChip') && cardSrc.includes('Next F/U'))
check(10, 'Overdue follow-up status logic', rows.some((r) => r.status.id === 'overdue_followup') || rows.some((r) => r.summary.hasOverdueFollowUp))
check(11, 'Open 360 action on company card component', cardSrc.includes('Open 360'))
check(12, 'New Opportunity from companies page command bar', pageSrc.includes('/crm/opportunities/new'))
check(13, 'Quick follow-up from companies page', pageSrc.includes('QuickFollowUpDrawer'))
check(14, 'Quotations linked from CRM navigation', pageSrc.includes('/crm/quotations'))
check(15, 'Demo data uses realistic customer names', !CRM_EXTENSION_CUSTOMERS.some((c) => c.customerName.includes('CRM Demo Customer')))
check(16, 'Demo contacts use realistic names', !crm.contacts.some((c) => c.name.startsWith('Primary Contact')))
check(17, 'Page guide hidden on CRM pages', !pageSrc.includes('pageGuide={{') && resolvePageGuide('/crm/customers') === null)
check(18, 'Embedded register filters on companies table', tableSrc.includes('registerFilter') && tableSrc.includes('crm-list-filter-bar--embedded'))
check(19, 'Responsive layout CSS at 1366px', cssSrc.includes('crm-companies-grid') && cssSrc.includes('1024px'))
check(20, 'Table uses enterprise row actions menu', tableSrc.includes('EnterpriseRowActionsMenu'))
check(21, 'Uses ErpCommandBar', pageSrc.includes('ErpCommandBar'))
check(22, 'Uses enterprise KPI strip', pageSrc.includes('kpiStrip={companyKpiStrip}'))
check(23, 'Smart company status utility', typeof resolveCrmCompanyStatus === 'function')
check(24, 'test:crm-companies-ui wired into package.json', pkg.includes('test:crm-companies-ui'))
check(25, 'Wired into CI', ci.includes('test:crm-companies-ui'))
check(26, 'Wired into UAT', uat.includes('test:crm-companies-ui'))
check(27, 'Wired into eeta-100', eeta.includes('test:crm-companies-ui'))
check(28, 'Wired into full-system-uat', fullUat.includes('test:crm-companies-ui'))
check(29, 'Command bar buttons omit hover tooltips', !readSrc('src/components/ui/CommandBar.tsx').includes('title={label}'))

const crmIntegration = runPackageScript('test:crm-integration', ROOT)
check(30, 'Existing CRM integration tests pass', crmIntegration.status === 0)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
