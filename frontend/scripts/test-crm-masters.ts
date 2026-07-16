/**
 * CRM Master Setup — npm run test:crm-masters
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
const { useCrmMasterStore } = await import('../src/store/crmMasterStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { CRM_MASTERS_CATALOG, CRM_LINKED_MASTERS } = await import('../src/config/crmMastersCatalog')
const { resolveLeadStageOptions, resolveLeadPriorityOptions } = await import('../src/utils/leadUtils')
const { getActiveLeadUsers } = await import('../src/data/crm/leadUsers')
const { canDeleteMasterEntry } = await import('../src/utils/crmMasterUtils')
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

console.log('\nCRM Master Setup Tests\n')
resetDemoBaseline()

const nav = read('src/config/navigation.ts')
const routes = read('src/routes/crmRoutes.tsx')
const formSrc = read('src/modules/crm/CrmLeadFormPage.tsx')
const pkg = read('package.json')
const ci = read('scripts/run-ci.ts')
const uat = read('scripts/test-uat.ts')
const eeta = read('scripts/test-eeta-100.ts')
const eeata = read('scripts/test-crm-eeata-fix.ts')

const store = useCrmMasterStore.getState()
const sales = useSalesStore.getState()
const today = new Date().toISOString().slice(0, 10)

check(1, 'Masters menu appears', nav.includes("path: '/crm/masters'") && nav.includes("label: 'Masters'"))
check(2, 'CRM Masters hub route', routes.includes('CrmMastersHubPage') && routes.includes("path: 'masters'"))
check(3, 'Company Master linked route', routes.includes("path: 'masters/companies'"))
check(4, 'Contact Master linked route', routes.includes("path: 'masters/contacts'"))
check(5, 'Lead Source Master route', routes.includes("path: 'masters/:kind'") && CRM_MASTERS_CATALOG.some((c) => c.kind === 'lead-sources'))
check(6, 'Industry Master seeded', store.getByKind('industries', true).length >= 10)
check(7, 'Territory Master seeded', store.getByKind('territories', true).length >= 5)
check(8, 'CRM Owner Master works', getActiveLeadUsers().length >= 3)
check(9, 'Lead Stage Master works', resolveLeadStageOptions().length === 7)
check(10, 'Lead Priority Master works', resolveLeadPriorityOptions().length === 4)
check(11, 'Lead Reason Master works', store.getByKind('lead-reasons', false).length >= 15)
check(12, 'Opportunity Stage Master works', store.getByKind('opportunity-stages', true).length === 10)
check(13, 'Engagement Type Master works', store.getByKind('activity-types', true).length >= 10)
check(14, 'Follow-up Type Master merged', !CRM_MASTERS_CATALOG.some((c) => c.kind === 'follow-up-types'))
check(15, 'Product Interest Master works', store.getByKind('product-interests', true).length >= 5)
check(16, 'Competitor Master removed', !CRM_MASTERS_CATALOG.some((c) => c.kind === 'competitors'))
check(17, 'Lost Reason Master works', store.getByKind('lost-reasons', true).length >= 5)
check(18, 'Quotation Template Master linked', CRM_LINKED_MASTERS.some((m) => m.slug === 'quotation-templates'))
check(19, 'Commercial Terms Master works', store.getByKind('commercial-terms', true).length >= 5)
check(20, 'Payment Terms Master works', store.getByKind('payment-terms', true).length >= 4)
check(21, 'Delivery Terms Master works', store.getByKind('delivery-terms', true).length >= 4)
check(22, 'Warranty Terms Master works', store.getByKind('warranty-terms', true).length >= 3)
check(23, 'Approval Rule Master works', store.getByKind('approval-rules', true).length >= 3)
check(24, 'Document Type Master works', store.getByKind('document-types', true).length >= 5)

const inactiveStage = store.getByKind('lead-stages', false).find((e) => e.code === 'new')
if (inactiveStage) {
  store.updateEntry(inactiveStage.id, { status: 'inactive' })
}
check(25, 'Inactive master values excluded from new form options', !resolveLeadStageOptions().includes('new'))
store.updateEntry(inactiveStage!.id, { status: 'active' })

const lead = sales.createLead({
  prospectName: 'Master Usage Test',
  customerId: null,
  leadOwnerId: 'user-rajesh',
  leadOwnerName: 'Rajesh Kumar',
  expectedValue: 100000,
  priority: 'high',
  createdDate: today,
  activityStatus: 'active',
  lifecycleStatus: 'open',
  stage: 'new',
  productRequirement: 'Test',
  source: 'referral',
  industry: 'Cement',
})
const stageEntry = store.getByCode('lead-stages', 'new')
check(26, 'Used master values cannot be hard deleted', stageEntry ? !canDeleteMasterEntry(stageEntry).ok : false)

check(27, 'Lead form uses CRM master hooks', formSrc.includes('useLeadReasonOptions') && formSrc.includes('buildLeadStageSmartSelectOptions') && formSrc.includes('useLeadSourceOptions'))
check(28, 'Lead form fetches Source/Industry from company (read-only)', formSrc.includes('onCompanyLinked') && formSrc.includes('setIndustry') && formSrc.includes('Industry'))
check(29, 'CRM reports module present', read('src/modules/reports/CrmReportsPages.tsx').includes('CrmReportPage'))
check(30, 'Master store persisted', read('src/store/crmMasterStore.ts').includes('vasant-crm-masters'))
check(31, 'CRM freeze suite includes masters test', eeata.includes('test:crm-masters'))

check(32, 'Wired into package.json', pkg.includes('test:crm-masters'))
check(33, 'Wired into CI', ci.includes('test:crm-masters'))
check(34, 'Wired into UAT', uat.includes('test:crm-masters'))
check(35, 'Wired into eeta-100', eeta.includes('test:crm-masters'))
check(36, 'Wired into crm-freeze suite', eeata.includes('test:crm-masters'))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
