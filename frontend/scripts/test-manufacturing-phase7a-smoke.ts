/**
 * Manufacturing Phase 7A (warehouse / material recon / FG / store workbench) smoke.
 * Run: npm run test:manufacturing-phase7a
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

console.log('\n── Manufacturing Phase 7A (Store Workbench) smoke ──\n')

console.log('Backend:')
check(
  'warehouse-mapping routes',
  exists('../backend/src/modules/manufacturing/warehouse-mappings/warehouse-mapping.routes.ts'),
)
check(
  'material-position service',
  exists('../backend/src/modules/manufacturing/materials/material-position.service.ts'),
)
check(
  'material-reconciliation service',
  exists('../backend/src/modules/manufacturing/materials/material-reconciliation.service.ts'),
)
check(
  'wip-position service',
  exists('../backend/src/modules/manufacturing/wip-movements/wip-position.service.ts'),
)
check('fg-receipt routes', exists('../backend/src/modules/manufacturing/fg-receipts/fg-receipt.routes.ts'))
check(
  'close-readiness service',
  exists('../backend/src/modules/manufacturing/work-orders/close-readiness.service.ts'),
)
check(
  'store-workbench routes',
  exists('../backend/src/modules/manufacturing/store-workbench/store-workbench.routes.ts'),
)
check(
  'store-workbench service',
  exists('../backend/src/modules/manufacturing/store-workbench/store-workbench.service.ts'),
)
const mfgRoutes = read('../backend/src/modules/manufacturing/manufacturing.routes.ts')
check('mounted /warehouse-mappings', mfgRoutes.includes('/warehouse-mappings'))
check('mounted /store-workbench', mfgRoutes.includes('/store-workbench'))
const woRoutes = read('../backend/src/modules/manufacturing/work-orders/work-order.routes.ts')
check('WO materials/position', woRoutes.includes("'/position'") || read('../backend/src/modules/manufacturing/materials/material.routes.ts').includes("'/position'"))
check('WO fg-eligibility', woRoutes.includes('fg-eligibility'))
check('WO wip-position', woRoutes.includes('wip-position'))
check('WO close-readiness', woRoutes.includes('close-readiness'))

console.log('\nFrontend:')
const api = read('src/services/api/manufacturingApi.ts')
check('listWarehouseMappings', api.includes('listWarehouseMappings'))
check('getWarehouseMapping', api.includes('getWarehouseMapping'))
check('createWarehouseMapping', api.includes('createWarehouseMapping'))
check('updateWarehouseMapping', api.includes('updateWarehouseMapping'))
check('resolveWarehouseMapping', api.includes('resolveWarehouseMapping'))
check('getMaterialPosition', api.includes('getMaterialPosition'))
check('getMaterialReconciliation', api.includes('getMaterialReconciliation'))
check('releaseReservation', api.includes('releaseReservation'))
check('reallocateReservation', api.includes('reallocateReservation'))
check('getWipPosition', api.includes('getWipPosition'))
check('getFgEligibility', api.includes('getFgEligibility'))
check('listFgReceipts', api.includes('listFgReceipts'))
check('previewFgReceipt', api.includes('previewFgReceipt'))
check('postFgReceipt', api.includes('postFgReceipt'))
check('getCloseReadiness', api.includes('getCloseReadiness'))
check('getStoreWorkbenchSummary', api.includes('getStoreWorkbenchSummary'))
check(
  'StoreWorkbenchPage',
  exists('src/modules/manufacturing/store-workbench/StoreWorkbenchPage.tsx'),
)
const routes = read('src/routes/manufacturingRoutes.tsx')
check('route store-workbench', routes.includes("manufacturing/store-workbench"))
const nav = read('src/config/navigation.ts')
check('nav Store Workbench', nav.includes('/manufacturing/store-workbench'))
const perms = read('src/utils/permissions/manufacturing.ts')
check('permission store_workbench.view', perms.includes("'manufacturing.store_workbench.view'"))
check('canViewStoreWorkbench', perms.includes('canViewStoreWorkbench'))

console.log('\nDocs:')
check('MATERIAL_ISSUE_SEMANTICS.md', exists('../docs/manufacturing/MATERIAL_ISSUE_SEMANTICS.md'))
check('PRODUCTION_PHASE7A_README.md', exists('../docs/manufacturing/PRODUCTION_PHASE7A_README.md'))
const readme = read('../docs/manufacturing/PRODUCTION_PHASE7A_README.md')
check('7A README status shipping', /Status:.*[Ss]hipp/i.test(readme) || readme.includes('7A5'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
