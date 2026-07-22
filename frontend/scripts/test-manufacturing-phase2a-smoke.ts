/**
 * Manufacturing Phase 2A (production demands + work order execution) smoke test —
 * file existence + API client exports + route/nav/permission wiring.
 * Run: npm run test:manufacturing-phase2a
 */
import { existsSync, readFileSync } from 'node:fs'
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
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function fileExists(relPath: string): boolean {
  return existsSync(path.join(ROOT, relPath))
}

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

console.log('\n── Manufacturing production (Phase 2A) smoke ──\n')

console.log('Types & API service:')
check('manufacturingProduction types file exists', fileExists('src/types/manufacturingProduction.ts'))
check('manufacturingApi service file exists', fileExists('src/services/api/manufacturingApi.ts'))

const apiSrc = read('src/services/api/manufacturingApi.ts')
const expectedApiExports = [
  'listDemands',
  'getDemand',
  'createManualDemand',
  'cancelDemand',
  'listEligibleSalesOrders',
  'getSalesOrderLineEligibility',
  'convertSalesOrderLine',
  'listWorkOrders',
  'getWorkOrdersSummary',
  'getWorkOrder',
  'getWorkOrderDetail',
  'getWorkOrderActivities',
  'getWorkOrderLedger',
  'createManualWorkOrder',
  'cancelWorkOrder',
  'releaseWorkOrder',
  'startWorkOrder',
  'holdWorkOrder',
  'resumeWorkOrder',
  'completeWorkOrder',
  'recordProgress',
  'completeStage',
  'correctProgress',
  'getTodayDashboard',
  'getControlRoomDashboard',
]
for (const fn of expectedApiExports) {
  check(`API client exports ${fn}`, apiSrc.includes(`export async function ${fn}(`))
}

console.log('\nPermissions:')
const permissionsSrc = read('src/utils/permissions/manufacturing.ts')
const expectedPermissionKeys = [
  'manufacturing.demand.view',
  'manufacturing.demand.create',
  'manufacturing.demand.convert',
  'manufacturing.work_orders.release',
  'manufacturing.work_orders.assign',
  'manufacturing.stage.view',
  'manufacturing.stage.execute',
  'manufacturing.progress.record',
  'manufacturing.progress.correct',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
]
for (const key of expectedPermissionKeys) {
  check(`Permission key defined: ${key}`, permissionsSrc.includes(`'${key}'`))
}
check(
  'useManufacturingWorkOrderPermissions hook exported',
  permissionsSrc.includes('export function useManufacturingWorkOrderPermissions'),
)

const permissionsIndexSrc = read('src/utils/permissions/index.ts')
check('permissions index re-exports work order hook', permissionsIndexSrc.includes('useManufacturingWorkOrderPermissions'))

console.log('\nPages & components:')
const phase2aFiles: Array<[string, string]> = [
  ['API work order register page', 'src/modules/manufacturing/work-orders/ApiWorkOrderRegisterPage.tsx'],
  ['API work order create page', 'src/modules/manufacturing/work-orders/ApiWorkOrderCreatePage.tsx'],
  ['API work order detail page', 'src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx'],
  ['Record progress drawer', 'src/modules/manufacturing/work-orders/components/RecordProgressDrawer.tsx'],
  ['Work order tone helpers', 'src/modules/manufacturing/work-orders/workOrderTone.ts'],
  ['Today page', 'src/modules/manufacturing/today/TodayPage.tsx'],
  ['API control room view', 'src/modules/manufacturing/ApiProductionControlRoomView.tsx'],
]
for (const [label, relPath] of phase2aFiles) {
  check(label, fileExists(relPath), relPath)
}

console.log('\nRoutes:')
const routesSrc = read('src/routes/manufacturingRoutes.tsx')
check('Route registered: manufacturing/today', routesSrc.includes("'manufacturing/today'"))
check('Route registered: manufacturing/work-orders', routesSrc.includes("'manufacturing/work-orders'"))
check("Route registered: manufacturing/work-orders/:workOrderId", routesSrc.includes("'manufacturing/work-orders/:workOrderId'"))
check('Route registered: manufacturing/work-orders/new', routesSrc.includes("'manufacturing/work-orders/new'"))
check('Work order routes branch on isApiMode()', routesSrc.includes('isApiMode()'))
check('No competing /manufacturing/orders route', !routesSrc.includes("'manufacturing/orders'"))

console.log('\nNavigation:')
const navSrc = read('src/config/navigation.ts')
check('Nav includes Today link', navSrc.includes("path: '/manufacturing/today'"))
check('Nav preserves Work Orders link', navSrc.includes("path: '/manufacturing/work-orders'"))
check('Nav preserves Control Room link', navSrc.includes("path: '/manufacturing/control-room'"))
check('Nav preserves Setup group', navSrc.includes("group: 'Setup'"))

console.log('\nControl Room:')
const controlRoomSrc = read('src/modules/manufacturing/ProductionControlRoomPage.tsx')
check('Control Room branches on isApiMode()', controlRoomSrc.includes('isApiMode()'))
check('Control Room renders ApiProductionControlRoomView', controlRoomSrc.includes('ApiProductionControlRoomView'))

console.log(`\n${failed === 0 ? '✓ All checks passed' : `✗ ${failed} check(s) failed`} (${passed} passed, ${failed} failed)\n`)
if (failed > 0) process.exit(1)
