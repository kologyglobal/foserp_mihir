/**
 * Manufacturing Phase 7D (ops reporting: report catalog/runner, shopfloor live,
 * Phase 7D — Manufacturing ops reporting (catalog, runner, shopfloor, exceptions, traceability) smoke.
 * Verifies frontend wiring; backend ops-reports module is mounted and covered by vitest.

 * Run: npm run test:manufacturing-phase7d
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function exists(rel: string) {
  return existsSync(path.join(ROOT, rel))
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\n── Manufacturing Phase 7D (Ops Reporting) smoke ──\n')

console.log('API client:')
check('opsReportsApi.ts exists', exists('src/services/api/opsReportsApi.ts'))
const opsApi = exists('src/services/api/opsReportsApi.ts') ? read('src/services/api/opsReportsApi.ts') : ''
check('getManufacturingReportCatalog', opsApi.includes('getManufacturingReportCatalog'))
check('queryManufacturingReport', opsApi.includes('queryManufacturingReport'))
check('exportManufacturingReport', opsApi.includes('exportManufacturingReport'))
check('listSavedViews', opsApi.includes('listSavedViews'))
check('createSavedView', opsApi.includes('createSavedView'))
check('updateSavedView', opsApi.includes('updateSavedView'))
check('deleteSavedView', opsApi.includes('deleteSavedView'))
check('getShopfloorLive', opsApi.includes('getShopfloorLive'))
check('getExceptionsSummary', opsApi.includes('getExceptionsSummary'))
check('listExceptions', opsApi.includes('listExceptions'))
check('acknowledgeException', opsApi.includes('acknowledgeException'))
check('searchTraceability', opsApi.includes('searchTraceability'))
check('getTraceabilityLineage', opsApi.includes('getTraceabilityLineage'))
check('path /reports/manufacturing/catalog', opsApi.includes('/reports/manufacturing/catalog'))
check('path /reports/manufacturing/${key}/query', opsApi.includes('/reports/manufacturing/${reportKey}/query'))
check('path /reports/manufacturing/${key}/export', opsApi.includes('/reports/manufacturing/${reportKey}/export'))
check('path /reports/saved-views', opsApi.includes('/reports/saved-views'))
check('path /manufacturing/shopfloor/live', opsApi.includes('/manufacturing/shopfloor/live'))
check('path /operations/exceptions', opsApi.includes('/operations/exceptions'))
check('path /manufacturing/traceability/search', opsApi.includes('/manufacturing/traceability/search'))

const client = read('src/services/api/client.ts')
check('apiPostDownloadBlob helper', client.includes('export async function apiPostDownloadBlob'))

console.log('\nPages:')
check('ManufacturingReportsPage.tsx', exists('src/modules/manufacturing/reports/ManufacturingReportsPage.tsx'))
const reportsPage = read('src/modules/manufacturing/reports/ManufacturingReportsPage.tsx')
check('reports page loads catalog in API mode', reportsPage.includes('getManufacturingReportCatalog'))
check('reports page groups by module', reportsPage.includes('grouped'))
check('reports page marks UNAVAILABLE reports', reportsPage.includes('UNAVAILABLE'))

check('ManufacturingReportRunnerPage.tsx', exists('src/modules/manufacturing/reports/ManufacturingReportRunnerPage.tsx'))
const runnerPage = read('src/modules/manufacturing/reports/ManufacturingReportRunnerPage.tsx')
check('runner page queries report', runnerPage.includes('queryManufacturingReport'))
check('runner page export CSV', runnerPage.includes('exportManufacturingReport'))
check('runner page calculation notes', runnerPage.includes('calculationNotes'))
check('runner page pagination', runnerPage.includes('pagination'))
check('runner page demo banner', runnerPage.includes('ManufacturingDemoBanner'))

check('ShopfloorLivePage.tsx', exists('src/modules/manufacturing/shopfloor/ShopfloorLivePage.tsx'))
const shopfloorLive = read('src/modules/manufacturing/shopfloor/ShopfloorLivePage.tsx')
check('shopfloor live auto-refresh toggle', shopfloorLive.includes('autoRefresh'))
check('shopfloor live never claims Live when off', /autoRefresh \? [`'"]Auto-refresh on/.test(shopfloorLive))
check('shopfloor live uses getShopfloorLive', shopfloorLive.includes('getShopfloorLive'))
check('shopfloor live demo banner', shopfloorLive.includes('ManufacturingDemoBanner'))

check('ExceptionCentrePage.tsx', exists('src/modules/operations/ExceptionCentrePage.tsx'))
const exceptionsPage = read('src/modules/operations/ExceptionCentrePage.tsx')
check('exceptions page KPI summary', exceptionsPage.includes('getExceptionsSummary'))
check('exceptions page list', exceptionsPage.includes('listExceptions'))
check('exceptions page acknowledge', exceptionsPage.includes('acknowledgeException'))
check('exceptions page open-source link', exceptionsPage.includes('sourceLink'))
check('exceptions page demo banner', exceptionsPage.includes('ManufacturingDemoBanner'))

check('TraceabilityPage.tsx', exists('src/modules/manufacturing/traceability/TraceabilityPage.tsx'))
const traceabilityPage = read('src/modules/manufacturing/traceability/TraceabilityPage.tsx')
check('traceability search', traceabilityPage.includes('searchTraceability'))
check('traceability lineage timeline', traceabilityPage.includes('getTraceabilityLineage'))
check('traceability demo banner', traceabilityPage.includes('ManufacturingDemoBanner'))

console.log('\nQuality / Dispatch soft-wire:')
const qualityPages = read('src/modules/quality/QualityProductionPages.tsx')
check('QualityReportsPage soft-wires to manufacturing reports', qualityPages.includes('/manufacturing/reports/quality-summary'))
const dispatchPages = read('src/modules/dispatch/DispatchProductionPages.tsx')
check('DispatchReportsPage soft-wires to manufacturing reports', dispatchPages.includes('/manufacturing/reports/dispatch-summary'))

console.log('\nRoutes:')
const routes = read('src/routes/manufacturingRoutes.tsx')
check('route manufacturing/reports/:reportKey', routes.includes('manufacturing/reports/:reportKey'))
check('route manufacturing/shopfloor dual-mode', routes.includes('ShopfloorLivePage') && routes.includes('ShopfloorViewPage'))
check('route manufacturing/traceability', routes.includes('manufacturing/traceability'))
check('routes/index.tsx wires operationsRouteChildren', exists('src/routes/operationsRoutes.tsx') && read('src/routes/index.tsx').includes('operationsRouteChildren'))
const opsRoutes = exists('src/routes/operationsRoutes.tsx') ? read('src/routes/operationsRoutes.tsx') : ''
check('route operations/exceptions', opsRoutes.includes('operations/exceptions'))

console.log('\nNavigation:')
const nav = read('src/config/navigation.ts')
check('nav Traceability', nav.includes('/manufacturing/traceability'))
check('nav Exceptions', nav.includes('/operations/exceptions'))

console.log('\nPermissions:')
const perms = read('src/utils/permissions/manufacturing.ts')
check('permission reports.shopfloor.view', perms.includes("'manufacturing.reports.shopfloor.view'"))
check('permission traceability.view', perms.includes("'manufacturing.traceability.view'"))
check('permission exceptions.view', perms.includes("'manufacturing.exceptions.view'"))
check('permission exceptions.acknowledge', perms.includes("'manufacturing.exceptions.acknowledge'"))
check('canViewShopfloorLive helper', perms.includes('canViewShopfloorLive'))
check('canViewTraceability helper', perms.includes('canViewTraceability'))
check('canViewExceptions helper', perms.includes('canViewExceptions'))
check('canAcknowledgeException helper', perms.includes('canAcknowledgeException'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
if (failed === 0) {
  console.log(
    'Note: backend ops-reports is mounted at /reports/manufacturing/*, /manufacturing/shopfloor/live,\n' +
      '/operations/exceptions, /manufacturing/traceability/* — covered by backend vitest\n' +
      'ops-reports-phase7d.test.ts. Frontend pages use API mode when VITE_USE_API=true.\n',
  )
}
process.exit(failed > 0 ? 1 : 0)
