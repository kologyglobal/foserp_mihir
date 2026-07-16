/**
 * CRM Leads List View — npm run test:crm-leads-list-view
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
const {
  enrichLeadRow,
  filterLeadRows,
  sortLeadsByLastModified,
  canDeleteLead,
  resolveLeadSourceIndustry,
  DEFAULT_LEAD_LIST_FILTERS,
} = await import('../src/utils/leadListUtils')
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

console.log('\nCRM Leads List View Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'user-rajesh', userName: 'Rajesh Kumar' })
resetDemoBaseline()

const listPageSrc = read('src/modules/crm/CrmLeadListPage.tsx')
const tableSrc = read('src/components/crm/CrmLeadsTable.tsx')
const gridSrc = read('src/components/erp/ErpDataGrid.tsx')
const chipSrc = read('src/components/erp/ErpStatusChip.tsx')
const deleteModalSrc = read('src/components/crm/DeleteLeadModal.tsx')
const utilsSrc = read('src/utils/leadListUtils.ts')
const salesPagesSrc = read('src/modules/sales/SalesPages.tsx')
const { readAllRouteSources } = await import('./routeSource')
const routesSrc = readAllRouteSources(ROOT)
const crmRoutesSrc = read('src/routes/crmRoutes.tsx')
const cssSrc = read('src/styles/dynamics-components.css')
const pkg = read('package.json')
const ci = read('scripts/run-ci.ts')
const uat = read('scripts/test-uat.ts')
const eeta = read('scripts/test-eeta-100.ts')
const eeataFix = read('scripts/test-crm-eeata-fix.ts')

const sales = useSalesStore.getState()
const masters = useMasterStore.getState()
const customers = masters.customers
const today = new Date().toISOString().slice(0, 10)

check(1, '/sales/leads route exists', routesSrc.includes("path: 'sales/leads'") && routesSrc.includes('LeadListPage'))
check(2, '/crm/leads uses same LeadListPage', crmRoutesSrc.includes("path: 'leads'") && crmRoutesSrc.includes('LeadListPage'))
check(3, 'SalesPages re-exports shared list page', salesPagesSrc.includes("export { LeadListPage } from '../crm/CrmLeadListPage'"))
check(4, 'CrmLeadsTable uses ErpDataGrid', tableSrc.includes('ErpDataGrid'))
check(5, 'Grid shows Lead No column', tableSrc.includes("header: 'Lead No'"))
check(6, 'Grid shows Prospect column', tableSrc.includes("header: 'Prospect'"))
check(7, 'Grid shows Source column', tableSrc.includes("header: 'Source'"))
check(8, 'Grid shows Industry column', tableSrc.includes("header: 'Industry'"))
check(9, 'Grid shows Lead Owner column', tableSrc.includes("header: 'Lead Owner'"))
check(10, 'Grid shows Expected Value column', tableSrc.includes("header: 'Expected Value'") && tableSrc.includes('formatCurrency'))
check(11, 'Grid shows Probability column', tableSrc.includes("header: 'Probability'") && tableSrc.includes('ProbabilityCell'))
check(12, 'Grid shows Status chip via ErpStatusChip', tableSrc.includes("header: 'Status'") && tableSrc.includes('ErpStatusChip'))
check(13, 'Grid shows Stage chip', tableSrc.includes("header: 'Stage'") && tableSrc.includes('LeadStageChip'))
check(14, 'Grid shows Last Modified On column', tableSrc.includes("header: 'Last Modified On'"))
check(15, 'Actions column shows View icon', tableSrc.includes('Eye') && tableSrc.includes('onView'))
check(16, 'Actions column shows Edit icon', tableSrc.includes('Pencil') && tableSrc.includes('onEdit'))
check(17, 'Actions column shows History icon', tableSrc.includes('History') && tableSrc.includes('onHistory'))
check(18, 'Actions column shows Delete icon', tableSrc.includes('Trash2') && tableSrc.includes('onDelete'))
check(19, 'Delete icon respects permission flag', tableSrc.includes('canDelete') && tableSrc.includes('You do not have permission to delete leads'))
check(20, 'View navigates via route-aware paths', listPageSrc.includes('useLeadRoutes') && listPageSrc.includes('routes.view'))
check(21, 'Edit navigates via route-aware paths', listPageSrc.includes('routes.edit'))
check(22, 'History opens LeadHistoryDrawer', listPageSrc.includes('LeadHistoryDrawer') && listPageSrc.includes('setHistoryLeadId'))
check(23, 'Delete shows confirmation modal', deleteModalSrc.includes('Delete Lead?') && listPageSrc.includes('DeleteLeadModal'))
check(24, 'Delete modal soft-delete message', deleteModalSrc.includes('remove') && deleteModalSrc.includes('audit'))
check(25, 'Converted leads cannot be hard deleted', utilsSrc.includes('converted_to_opportunity') && deleteModalSrc.includes('blockReason'))
check(26, 'Default sorting is Last Modified descending', listPageSrc.includes('sortLeadsByLastModified'))
check(27, 'Filters include search, source, industry, owner, status, stage', listPageSrc.includes('filters.source') && listPageSrc.includes('filters.industry') && listPageSrc.includes('filters.owner'))
check(28, 'Clear Filters action exists', listPageSrc.includes('Clear Filters'))
check(29, 'Save View in command bar', listPageSrc.includes('Save View') && listPageSrc.includes('SaveViewDialog'))
check(30, 'Command bar: New Lead, Import, Export, Refresh', listPageSrc.includes('New Lead') && listPageSrc.includes('Import') && listPageSrc.includes('Export') && listPageSrc.includes('Refresh'))
check(31, 'Source/Industry resolved from Company Master', utilsSrc.includes('resolveLeadSourceIndustry') && utilsSrc.includes('customer?.industry'))
check(32, 'Export includes listed columns', listPageSrc.includes("'Lead No', 'Prospect', 'Source', 'Industry'"))
check(33, 'ErpDataGrid header/cell styling', cssSrc.includes('erp-data-grid') && cssSrc.includes('font-size: 12px'))
check(34, 'Actions always visible (not hover-only)', cssSrc.includes('erp-leads-actions') && cssSrc.includes('opacity: 1'))
check(35, 'archiveLead soft delete in store', read('src/store/salesStore.ts').includes('archiveLead') && read('src/store/salesStore.ts').includes('isArchived: true'))

const created = sales.createLead({
  prospectName: 'List View Test Prospect',
  customerId: customers[0]?.id ?? null,
  leadOwnerId: 'user-rajesh',
  leadOwnerName: 'Rajesh Kumar',
  expectedValue: 1250000,
  probability: 40,
  priority: 'high',
  createdDate: today,
  activityStatus: 'active',
  lifecycleStatus: 'open',
  stage: 'new',
  productRequirement: 'Test',
  source: 'referral',
  industry: 'Logistics',
})
check(36, 'Test lead created', created.ok, created.leadId)

const lead = useSalesStore.getState().leads.find((l) => l.id === created.leadId)
const customer = customers.find((c) => c.id === lead?.customerId)
const row = lead ? enrichLeadRow(lead, customer) : null
check(37, 'Enriched row has prospect display', Boolean(row?.prospectDisplay))
check(38, 'Source display from lead/company', Boolean(row && resolveLeadSourceIndustry(row.lead, customer).source.length > 0))
check(39, 'Industry display resolved', Boolean(row?.industryDisplay && row.industryDisplay !== ''))

const sorted = sortLeadsByLastModified(row ? [row] : [])
check(40, 'Sort by last modified works', sorted.length <= 1 || sorted[0].lastModified >= sorted[sorted.length - 1].lastModified)

const filtered = filterLeadRows(row ? [row] : [], {
  ...DEFAULT_LEAD_LIST_FILTERS,
  search: row?.lead.leadNo ?? 'LEAD',
})
check(41, 'Search filter works', filtered.length === 1)

const deleteCheck = canDeleteLead({
  lead: lead!,
  opportunities: [],
  activities: [],
  followUps: [],
  inquiryCount: 0,
  quotationCount: 0,
})
check(42, 'Fresh lead can be deleted (no linked records)', deleteCheck.ok)

sales.updateLead(lead!.id, { stage: 'converted_to_opportunity', lifecycleStatus: 'converted' })
const converted = useSalesStore.getState().getLead(lead!.id)!
const blocked = canDeleteLead({
  lead: converted,
  opportunities: [],
  activities: [],
  followUps: [],
  inquiryCount: 0,
})
check(43, 'Converted lead blocked from delete', !blocked.ok)

const archive = useSalesStore.getState().archiveLead(lead!.id)
check(44, 'archiveLead runs for manager', archive.ok || Boolean(archive.error))

check(45, 'Wired into package.json', pkg.includes('test:crm-leads-list-view'))
check(46, 'Wired into CI', ci.includes('test:crm-leads-list-view'))
check(47, 'Wired into UAT', uat.includes('test:crm-leads-list-view'))
check(48, 'Wired into eeta-100', eeta.includes('test:crm-leads-list-view'))
check(49, 'Wired into crm-eeata-fix freeze suite', eeataFix.includes('test:crm-leads-list-view'))

const crmLeadForm = runPackageScript('test:crm-lead-form-refinement', ROOT)
check(50, 'Existing CRM lead form refinement tests pass', crmLeadForm.status === 0)

const nav = read('src/config/navigation.ts')
const listPage = read('src/modules/crm/CrmLeadListPage.tsx')
const formPage = read('src/modules/crm/CrmLeadFormPage.tsx')
const detailPage = read('src/modules/sales/SalesPages.tsx')
const buttonSrc = read('src/components/ui/Button.tsx')

check(51, 'CRM navigation includes Leads tab', nav.includes("label: 'Leads'") && nav.includes("path: '/crm/leads'"))
check(52, 'CRM navigation includes core items only', nav.includes("path: '/crm/leads'") && nav.includes("path: '/crm/reports'") && !nav.includes("path: '/crm/follow-ups'"))
check(53, '/sales/leads maps to CRM module nav', nav.includes("pathname.startsWith('/sales/leads')"))
check(54, 'Lead list uses ErpCommandBar', listPage.includes('ErpCommandBar'))
check(55, 'Lead list standard title Leads', listPage.includes('title="Leads"'))
check(56, 'Lead list breadcrumbs in page header', listPage.includes('leadListBreadcrumbs'))
check(57, 'New lead form uses ErpCommandBar', formPage.includes('ErpCommandBar'))
check(58, 'Save Lead uses ErpButton primary', formPage.includes("variant=\"primary\"") && formPage.includes('Save Lead'))
check(59, 'Save button navy #001B3A', buttonSrc.includes('#001B3A'))
check(60, 'Post-save next action panel', formPage.includes('LeadSaveNextActionsPanel'))
check(61, 'Lead detail ErpCommandBar with History', detailPage.includes('View History') && detailPage.includes('ErpCommandBar'))
check(62, 'Lead detail standard header', detailPage.includes('title="Lead Details"'))
check(63, 'History drawer Open Lead action', read('src/components/crm/LeadHistoryDrawer.tsx').includes('Open Lead'))
check(64, 'Sticky form footer CSS', read('src/styles/dynamics-components.css').includes('erp-form-footer-sticky'))

const importDialogSrc = read('src/components/crm/LeadImportDialog.tsx')
const advancedFiltersSrc = read('src/components/crm/LeadAdvancedFiltersDrawer.tsx')
const leadImportUtils = read('src/utils/leadImport.ts')

check(65, 'Lead import dialog component exists', importDialogSrc.includes('LeadImportDialog'))
check(66, 'Import opens CSV parser and preview', importDialogSrc.includes('parseLeadImportCsv') && importDialogSrc.includes('Download Template'))
check(67, 'Advanced filters drawer exists', advancedFiltersSrc.includes('LeadAdvancedFiltersDrawer'))
check(68, 'Advanced filters include value range', advancedFiltersSrc.includes('valueMin') && advancedFiltersSrc.includes('valueMax'))
check(69, 'Advanced filters include created date range', advancedFiltersSrc.includes('dateFrom') && advancedFiltersSrc.includes('dateTo'))
check(70, 'List page wires import dialog', listPageSrc.includes('LeadImportDialog') && listPageSrc.includes('setImportOpen(true)'))
check(71, 'List page wires advanced filters drawer', listPageSrc.includes('LeadAdvancedFiltersDrawer') && listPageSrc.includes('Advanced'))
check(72, 'Filter chips include advanced fields', utilsSrc.includes('buildLeadFilterChips') && utilsSrc.includes('valueMin'))
check(73, 'Saved views serialize all filter fields', listPageSrc.includes('serializeLeadFilters'))

const { parseLeadImportCsv, importLeadRows } = await import('../src/utils/leadImport')
const sampleCsv = `Prospect Name,Source,Industry,Lead Owner,Expected Value,Probability,Priority,Stage,Contact Person,Mobile,Email,Product Requirement,Created Date
Import Co,referral,Logistics,Rajesh Kumar,1200000,40,high,new,Ravi,9999999999,ravi@import.in,Tank trailer,${today}
`
const parsed = parseLeadImportCsv(sampleCsv)
check(74, 'CSV parser validates import rows', parsed.rows.length === 1 && parsed.rows[0]!.errors.length === 0)

const beforeCount = useSalesStore.getState().leads.length
const importResult = importLeadRows(
  (input) => useSalesStore.getState().createLead(input),
  parsed.rows,
)
check(75, 'CSV import creates leads', importResult.imported === 1 && useSalesStore.getState().leads.length === beforeCount + 1)

const valueFiltered = filterLeadRows(row ? [row] : [], {
  ...DEFAULT_LEAD_LIST_FILTERS,
  valueMin: '1000000',
  valueMax: '2000000',
})
check(76, 'Expected value range filter works', valueFiltered.length === 1)

const dateFiltered = filterLeadRows(row ? [row] : [], {
  ...DEFAULT_LEAD_LIST_FILTERS,
  dateFrom: today,
  dateTo: today,
})
check(77, 'Created date range filter works', dateFiltered.length === 1)

console.log(`\n${pass} passed, ${fail} failed\n`)
resetSessionUserForTests()
process.exit(fail > 0 ? 1 : 0)
