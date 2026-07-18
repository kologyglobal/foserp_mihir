/**
 * CRM Lead Form Refinement — npm run test:crm-lead-form-refinement
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
const { useSalesStore } = await import('../src/store/salesStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { buildCrmDashboardMetrics } = await import('../src/utils/crmMetrics')
const { searchCompanyProspects } = await import('../src/utils/companyProspectSearch')
const { getActiveLeadUsers } = await import('../src/data/crm/leadUsers')
const { normalizeLead } = await import('../src/utils/leadUtils')
const {
  getLeadRegisterReport,
  getLeadOwnerReport,
  getLeadPriorityReport,
  getClosedLeadReport,
  getLeadActiveInactiveReport,
  getLeadStageReport,
  getLeadConversionReport,
} = await import('../src/utils/crmReports')
const { LEAD_STAGE_OPTIONS, leadStageLabel } = await import('../src/utils/leadUtils')
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

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM Lead Form Refinement Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
resetDemoBaseline()

const formSrc = read('src/modules/crm/CrmLeadFormPage.tsx')
const companySelectSrc = read('src/components/crm/CompanyProspectSelect.tsx')
const salesPagesSrc = read('src/modules/sales/SalesPages.tsx')
const buttonSrc = read('src/components/ui/Button.tsx')
const erpButtonSrc = read('src/components/erp/ErpButton.tsx')
const cssSrc = read('src/styles/dynamics-components.css')
const pkg = read('package.json')
const ci = read('scripts/run-ci.ts')
const uat = read('scripts/test-uat.ts')
const eeta = read('scripts/test-eeta-100.ts')
const eeataFix = read('scripts/test-crm-eeata-fix.ts')
const routesSrc = read('src/routes/crmRoutes.tsx')

const sales = useSalesStore.getState()
const masters = useMasterStore.getState()
const customers = masters.customers
const contacts = masters.customerContacts
const today = new Date().toISOString().slice(0, 10)

check(1, 'New lead page module loads', formSrc.includes('export function CrmLeadFormPage'))
check(2, 'Company / Prospect field is searchable', companySelectSrc.includes('searchCompanyProspects'))
check(3, 'Existing company suggestions appear while typing', searchCompanyProspects(customers, contacts, 'Cement').length > 0)
check(4, 'CompanyProspectSelect auto-fills on selection', companySelectSrc.includes('onCompanyLinked'))
check(5, 'Source and Industry removed from editable Lead form sections', !formSrc.includes('FormField label="Source"') && !formSrc.includes('FormField label="Industry"'))
check(6, 'Source and Industry display as read-only company info', formSrc.includes('Company Source') || formSrc.includes('companyInfo'))
check(7, 'Add New Company button opens drawer', companySelectSrc.includes('Add New Company') && companySelectSrc.includes("openDrawer('customer'"))
check(8, 'New company saves into Company Master via quick create', companySelectSrc.includes('useMasterStore.getState().getCustomer'))
check(9, 'New company auto-selects in Lead form after save', companySelectSrc.includes('selectMatch'))
check(10, 'Lead Owner dropdown shows active users', getActiveLeadUsers().every((u) => u.isActive) && formSrc.includes('Lead Owner'))
check(11, 'Lead Owner defaults to current user', formSrc.includes('session.id'))
check(12, 'Priority dropdown exists', formSrc.includes('Priority') && formSrc.includes("'medium'"))
check(13, 'Created Date defaults to current date', formSrc.includes('todayIso') || formSrc.includes('createdDate'))
check(13b, 'Lead form validates CRM date/year bounds', formSrc.includes('validateCrmCalendarDate') && formSrc.includes('getCrmDateInputMax'))
check(13c, 'Created Date cannot be in the future', formSrc.includes('Created Date cannot be in the future'))
check(13d, 'Expected close date past blocked on create', formSrc.includes('Expected Closing Date cannot be in the past'))
check(14, 'Activity status single dropdown', formSrc.includes('activityStatus') && formSrc.includes('<option value="active">Active</option>') && !formSrc.includes('crm-lead-status-toggle'))
check(15, 'Inactive Reason required when inactive', formSrc.includes('inactiveReason') && formSrc.includes('activityStatus === \'inactive\''))
check(16, 'Closed Date defaults when lead stage is Closed', formSrc.includes("leadStage === 'closed'") && formSrc.includes('closedDate'))
check(17, 'Closed Reason required when closed stage', formSrc.includes('closedReason') && formSrc.includes("leadStage === 'closed'"))
check(18, 'Save Lead button is visible', formSrc.includes('Save Lead') && formSrc.includes('footerActions'))
check(19, 'Save Lead uses navy-blue primary style', buttonSrc.includes('#001B3A') && erpButtonSrc.includes('primary'))
check(20, 'Sticky action bar layout for 1366px', cssSrc.includes('crm-lead-form') && cssSrc.includes('1366px'))
check(21, 'Lead saves successfully', (() => {
  const r = sales.createLead({
    prospectName: 'Refinement Test Lead',
    customerId: customers[0]?.id ?? null,
    leadOwnerId: 'user-rajesh',
    leadOwnerName: 'Rajesh Kumar',
    expectedValue: 1200000,
    priority: 'high',
    createdDate: today,
    activityStatus: 'active',
    lifecycleStatus: 'open',
    stage: 'new',
    productRequirement: '45 m³ bulker',
    source: 'referral',
    industry: 'Cement',
  })
  return r.ok
})())
const saved = useSalesStore.getState().leads.find((l) => l.prospectName === 'Refinement Test Lead')
check(22, 'Saved lead appears in Lead Register', Boolean(saved), saved?.leadNo)
check(23, 'Lead detail page shows Edit action', salesPagesSrc.includes('label="Edit"') && salesPagesSrc.includes('LeadDetailPage'))
check(24, 'Lead list shows priority, owner, created date and status', salesPagesSrc.includes('Lead Owner') && salesPagesSrc.includes('createdDate') && salesPagesSrc.includes('priority'))
const metrics = buildCrmDashboardMetrics({
  opportunities: [],
  followUps: [],
  activities: [],
  quotationDocuments: [],
  leads: useSalesStore.getState().leads,
})
check(25, 'CRM dashboard lead metrics update', metrics.activeLeads >= 1 && typeof metrics.leadsCreatedToday === 'number')
check(26, 'Lead reports available', getLeadRegisterReport().length > 0 && getLeadOwnerReport().length > 0 && getLeadPriorityReport().length === 4 && getLeadActiveInactiveReport().length > 0)
const closedReport = getClosedLeadReport()
check(27, 'Closed lead report structure', Array.isArray(closedReport))

if (saved) {
  const n = normalizeLead(saved)
  check(35, 'Normalized lead has owner and priority', n.leadOwnerName.length > 0 && n.priority === 'high')
  check(36, 'Lead Stage defaults to New', n.stage === 'new')
}

check(37, 'Lead Stage searchable dropdown on New Lead form', formSrc.includes('Lead Stage') && formSrc.includes('ErpSmartSelect') && formSrc.includes('buildLeadStageSmartSelectOptions'))
check(38, 'Lead Stage is required in validation', formSrc.includes('Lead Stage is required'))
check(39, 'Lead Stage options are correct', LEAD_STAGE_OPTIONS.length === 7 && LEAD_STAGE_OPTIONS.includes('requirement_collected'))
check(40, 'Requirement required when stage is Requirement Collected', formSrc.includes('requirement_collected'))
check(41, 'Qualified stage shows Create Opportunity hint', formSrc.includes("leadStage === 'qualified'") && formSrc.includes('Create Opportunity'))
check(42, 'Not Qualified stage requires reason', formSrc.includes('notQualifiedReason') && formSrc.includes("leadStage === 'not_qualified'"))
check(43, 'Lead list shows Lead Stage chip', salesPagesSrc.includes('LeadStageChip') && salesPagesSrc.includes('Lead Stage'))
check(44, 'Lead detail shows Lead Stage', salesPagesSrc.includes('Stage history') && salesPagesSrc.includes('leadStageLabel'))
check(45, 'Stage change creates timeline activity', formSrc.includes('Stage changed from'))
check(46, 'CRM dashboard shows Leads by Stage', read('src/utils/crmMetrics.ts').includes('leadsByStage') && read('src/modules/crm/CrmDashboardPage.tsx').includes('CrmLeadStageFunnelChart'))
check(47, 'Lead stage report available', getLeadStageReport().length === 7)
check(48, 'Lead conversion report available', getLeadConversionReport().length >= 4)
check(49, 'Converted stage set on inquiry conversion', read('src/store/salesStore.ts').includes("'converted_to_opportunity'"))
check(50, 'Lead stage labels human readable', leadStageLabel('requirement_collected') === 'Requirement Collected')

const crmEeata = runPackageScript('test:crm-eeata-fix', ROOT)
check(51, 'Existing CRM freeze tests pass', crmEeata.status === 0)

check(52, 'CRM routes use CrmLeadFormPage', routesSrc.includes('CrmLeadFormPage'))
check(53, 'Wired into package.json', pkg.includes('test:crm-lead-form-refinement'))
check(54, 'Wired into CI', ci.includes('test:crm-lead-form-refinement'))
check(55, 'Wired into UAT', uat.includes('test:crm-lead-form-refinement'))
check(56, 'Wired into eeta-100', eeta.includes('test:crm-lead-form-refinement'))
check(57, 'Wired into crm-eeata-fix freeze suite', eeataFix.includes('test:crm-lead-form-refinement'))

const nav = read('src/config/navigation.ts')
check(58, 'CRM nav includes Leads and Masters', nav.includes("path: '/crm/leads'") && nav.includes("path: '/crm/masters'"))
check(59, 'Lead form breadcrumbs helper', read('src/utils/crmLeadNavigation.ts').includes('leadNewBreadcrumbs'))
check(60, 'Lead form route-aware save', formSrc.includes('useLeadRoutes'))
check(61, 'Lead form post-save next actions', formSrc.includes('LeadSaveNextActionsPanel'))
check(62, 'Sticky action bar on lead form', read('src/components/erp/ErpFormShell.tsx').includes('erp-form-shell-content--padded'))
check(63, 'Save button standard #001B3A', buttonSrc.includes('#001B3A'))
check(64, 'BC FastTab sections on lead form', formSrc.includes('CrmLeadFormSection') && read('src/components/crm/CrmLeadFormSection.tsx').includes('crm-lead-fasttab'))
check(65, 'BC fact box on lead form', formSrc.includes('CrmLeadFormFactBox') && formSrc.includes('crm-lead-form-grid'))
check(66, 'Dynamics font tokens on lead form page', cssSrc.includes('crm-lead-form-page') && cssSrc.includes('--d365-font-family'))

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
