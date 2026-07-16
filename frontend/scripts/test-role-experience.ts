/**
 * Role-based experience tests — npm run test:role-experience
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { setExperienceRole, getExperienceRole, resetSessionUserForTests } = await import('../src/utils/permissions')
const { ALL_EXPERIENCE_ROLES, getRoleExperienceDefinition, ROLE_HOME_ROUTES } = await import('../src/config/roleExperience')
const { getRoleExperienceData, computeAllRoleKpis } = await import('../src/utils/roleExperienceMetrics')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nRole Experience Tests\n')
resetSessionUserForTests()

check(1, 'Ten experience roles defined', ALL_EXPERIENCE_ROLES.length === 10)

for (const role of ALL_EXPERIENCE_ROLES) {
  const def = getRoleExperienceDefinition(role)
  if (!def.kpiIds.length || !def.shortcuts.length) {
    check(0, `${role} has KPIs and shortcuts`, false)
  }
}
check(2, 'Each role has KPIs + shortcuts configured', true)

setExperienceRole('ceo')
const ceo = getRoleExperienceData('ceo')
check(3, 'CEO home has KPIs', ceo.kpis.length >= 4, `${ceo.kpis.length} KPIs`)
check(4, 'CEO shortcuts include Executive Dashboard', ceo.definition.shortcuts.some((s) => s.path.includes('executive')))

setExperienceRole('purchase')
const purchase = getRoleExperienceData('purchase')
check(5, 'Purchase inbox filtered to procurement', purchase.inbox.every((i) => i.module.toLowerCase().includes('procurement') || purchase.inbox.length === 0))

setExperienceRole('quality')
const quality = getRoleExperienceData('quality')
check(6, 'Quality KPIs include QC pending', quality.kpis.some((k) => k.id === 'qcPending' || k.id === 'openNcr'))

setExperienceRole('accounts')
const accounts = getRoleExperienceData('accounts')
check(7, 'Accounts approvals include finance module filter', accounts.definition.approvalModules.includes('Finance'))

const allKpis = computeAllRoleKpis()
check(8, 'KPI registry populated', Object.keys(allKpis).length >= 30, `${Object.keys(allKpis).length} KPIs`)

check(9, 'Role home routes defined', ROLE_HOME_ROUTES.home === '/home' && ROLE_HOME_ROUTES.inbox === '/home/inbox')

setExperienceRole('engineering')
check(10, 'Experience role persists on session', getExperienceRole() === 'engineering')

console.log(`\n${passed}/${passed + failed} passed${failed ? ` (${failed} failed)` : ''}\n`)
process.exit(failed ? 1 : 0)
