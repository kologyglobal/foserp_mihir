/**
 * Modern ERP UI theme validation — npm run test:modern-erp-ui
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function hasCommandCenterShell(src: string) {
  return (
    src.includes('DynamicsModuleDashboard') ||
    src.includes('DynamicsExecutiveDashboard') ||
    src.includes('SaaSCommandDashboard') ||
    src.includes('CommandCenterHeader') ||
    (src.includes('PremiumPageShell') && src.includes('commandHero'))
  )
}

console.log('\nModern ERP UI Theme Tests\n')

const css = read('src/index.css')
check('1. Theme tokens — Dynamics primary blue', css.includes('--dyn-primary: #0078d4') || css.includes('--d365-brand: #0078d4') || css.includes('dynamics-tokens.css'))
check('2. Premium KPI card styles', css.includes('.erp-premium-kpi'))
check('3. Command hero styles', css.includes('.erp-command-hero'))

const premiumIndex = read('src/components/premium/index.ts')
check('4. PremiumKpiCard exported', premiumIndex.includes('PremiumKpiCard'))
check('5. CommandCenterHeader exported', premiumIndex.includes('CommandCenterHeader'))
check('6. PremiumPageShell exported', premiumIndex.includes('PremiumPageShell'))

const roleHome = read('src/modules/role-experience/RoleExperiencePages.tsx')
check('7. Role home has command center hero', roleHome.includes('SaaSCommandDashboard') || roleHome.includes('CommandCenterHeader'))

const exec = read('src/modules/control-towers/ExecutiveDashboardPage.tsx')
check('8. CEO dashboard uses Dynamics or SaaS shell', exec.includes('DynamicsExecutiveDashboard') || exec.includes('SaaSCommandDashboard') || (exec.includes('PremiumPageShell') && exec.includes('commandHero')))

const topbar = read('src/components/layout/Topbar.tsx')
check('9. Top bar Factory Live badge', topbar.includes('Factory Live'))

const search = read('src/components/design-system/GlobalSearch.tsx')
check('10. Command palette search placeholder', search.includes('Search masters, SO, WO, company, product, command'))

const pulsePath = 'src/components/layout/ShellLivePulse.tsx'
if (existsSync(path.join(ROOT, pulsePath))) {
  const pulse = read(pulsePath)
  check('11. Factory pulse uses live factory hook (10 events)', pulse.includes('useLiveFactoryPulse(10)'))
} else {
  check('11. Factory pulse component (optional)', read('src/hooks/useLiveFactoryPulse.ts').includes('useLiveFactoryPulse'))
}

const sidebar = read('src/components/layout/Sidebar.tsx')
check('12. Sidebar module badges', sidebar.includes('ModuleNavigationBadge') && sidebar.includes('useSidebarLiveCounts'))

const kpi = read('src/components/design-system/KPIWidget.tsx')
check('13. KPIWidget delegates to PremiumKpiCard', kpi.includes('PremiumKpiCard'))

const mock = read('src/hooks/useLiveActivityMock.ts')
const mockEvents = (mock.match(/icon:/g) ?? []).length
check('14. Live activity pool ≥ 8 events', mockEvents >= 8, String(mockEvents))

const uat = read('src/modules/uat/UatDashboardPage.tsx')
check('15. UAT dashboard uses Dynamics command shell', uat.includes('DynamicsModuleDashboard'))

check('16. SmartEmptyState component exists', existsSync(path.join(ROOT, 'src/components/premium/SmartEmptyState.tsx')))
check('17. RiskMeter component exists', existsSync(path.join(ROOT, 'src/components/premium/RiskMeter.tsx')))
check('18. sidebarLiveCounts utility exists', existsSync(path.join(ROOT, 'src/utils/sidebarLiveCounts.ts')))

const liveWs = read('src/components/live-erp/LiveWorkspaceSections.tsx')
check('19. Live workspace sections upgraded', liveWs.includes('erp-bc-section'))

const packageJson = read('package.json')
check('20. test:modern-erp-ui script registered', packageJson.includes('test:modern-erp-ui'))

const sales = read('src/modules/workspaces/SalesWorkspace.tsx')
check('21. Sales workspace command center hero', hasCommandCenterShell(sales))

const quality = read('src/modules/workspaces/QualityWorkspace.tsx')
check('22. Quality workspace command center hero', hasCommandCenterShell(quality))

const dispatch = read('src/modules/workspaces/DispatchWorkspace.tsx')
check('23. Dispatch workspace command center hero', hasCommandCenterShell(dispatch))

const production = read('src/modules/control-towers/ProductionControlTowerPage.tsx')
check('24. Production tower uses Dynamics command shell', hasCommandCenterShell(production))

const designSystem = read('src/design-system/index.ts')
check('26. Central design system barrel', designSystem.includes('ThemeProvider') && designSystem.includes('DataTable'))

console.log(`\nModern ERP UI: ${passed}/${passed + failed} passed\n`)
process.exit(failed > 0 ? 1 : 0)
