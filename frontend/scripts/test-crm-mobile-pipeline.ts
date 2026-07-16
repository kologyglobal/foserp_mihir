/**
 * Mobile CRM pipeline — npm run test:crm-mobile-pipeline
 */
import { readFileSync } from 'node:fs'
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

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { resetCrmBootstrapGuard } = await import('../src/demo/factories/crmEcosystemBootstrap')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const {
  buildMobileCrmPipelineMetrics,
  buildMobileCrmPipelineStages,
  mobileCrmEnabled,
} = await import('../src/utils/mobileCrmPipeline')
const { buildMobileTasks } = await import('../src/utils/mobileTasks')

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

console.log('\nMobile CRM Pipeline Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const mobileRoutes = read('src/routes/mobileRoutes.tsx')
check(1, 'Mobile CRM hub route at /m/crm', mobileRoutes.includes("path: 'crm', element: <MobileCrmPipelinePage />"))
check(2, 'Follow-ups route wired to page', mobileRoutes.includes("path: 'crm/follow-ups', element: <MobileCrmFollowUpsPage />"))
check(3, 'Activities route wired to page', mobileRoutes.includes("path: 'crm/activities', element: <MobileCrmActivitiesPage />"))
check(4, 'No follow-ups redirect to opportunities', !mobileRoutes.includes("crm/follow-ups', element: <Navigate"))
check(5, 'Pipeline nav component exists', read('src/components/mobile/MobileCrmPipelineNav.tsx').includes('MobileCrmPipelineNav'))
check(6, 'Pipeline metrics util exists', read('src/utils/mobileCrmPipeline.ts').includes('buildMobileCrmPipelineMetrics'))

const metrics = buildMobileCrmPipelineMetrics()
check(7, 'Pipeline metrics include open leads', metrics.openLeads >= 0, `leads=${metrics.openLeads}`)
check(8, 'Pipeline metrics include open opportunities', metrics.openOpportunities > 0, `opps=${metrics.openOpportunities}`)
check(9, 'Pipeline stages cover full funnel', buildMobileCrmPipelineStages(metrics).length === 7)

const tasks = buildMobileTasks('planning')
check(10, 'Mobile CRM enabled for sales manager', mobileCrmEnabled())
check(11, 'Mobile tasks include CRM pipeline task', tasks.some((t) => t.id === 'crm-pipeline' || t.id === 'crm-follow-ups' || t.id === 'crm-quote-approval'))

const shell = read('src/modules/mobile/MobileShellPages.tsx')
check(12, 'Modules page includes CRM Pipeline hub', shell.includes("label: 'CRM Pipeline'") && shell.includes("path: '/m/crm'"))
check(13, 'CRM pages include pipeline nav', read('src/modules/mobile/MobileCrmPages.tsx').includes('MobileCrmPipelineNav'))

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
