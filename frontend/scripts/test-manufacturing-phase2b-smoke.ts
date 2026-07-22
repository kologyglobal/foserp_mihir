/**
 * Manufacturing Phase 2B (operator UX, assignments, daily production, issues) smoke test —
 * file existence + API client exports + route/nav/permission wiring.
 * Run: npm run test:manufacturing-phase2b
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

console.log('\n── Manufacturing production (Phase 2B) smoke ──\n')

console.log('Types & API service:')
check('manufacturingPhase2b types file exists', fileExists('src/types/manufacturingPhase2b.ts'))
check('operatorStrings i18n module exists', fileExists('src/modules/manufacturing/i18n/operatorStrings.ts'))

const apiSrc = read('src/services/api/manufacturingApi.ts')
const expectedApiExports = [
  'listAssignments',
  'getAssignment',
  'getAssignmentHistory',
  'createAssignment',
  'reassignAssignment',
  'cancelAssignment',
  'acceptAssignment',
  'startAssignment',
  'pauseAssignment',
  'resumeAssignment',
  'completeAssignment',
  'listWorkOrderAssignments',
  'getMyWork',
  'listDailyProductionBatches',
  'getDailyProductionBatch',
  'createDailyProductionBatch',
  'updateDailyProductionBatch',
  'addDailyProductionLine',
  'updateDailyProductionLine',
  'removeDailyProductionLine',
  'validateDailyProductionBatch',
  'submitDailyProductionBatch',
  'correctDailyProductionLine',
  'listIssues',
  'getIssue',
  'reportIssue',
  'acknowledgeIssue',
  'markIssueInProgress',
  'resolveIssue',
  'cancelIssue',
]
for (const fn of expectedApiExports) {
  check(`API client exports ${fn}`, apiSrc.includes(`export async function ${fn}(`))
}

console.log('\nPermissions:')
const permissionsSrc = read('src/utils/permissions/manufacturing.ts')
const expectedPermissionKeys = [
  'manufacturing.daily_production.view',
  'manufacturing.daily_production.create',
  'manufacturing.daily_production.submit',
  'manufacturing.assignment.view',
  'manufacturing.assignment.manage',
  'manufacturing.assignment.reassign',
  'manufacturing.operator.my_work',
  'manufacturing.operator.start',
  'manufacturing.operator.pause',
  'manufacturing.operator.complete',
  'manufacturing.issue.view',
  'manufacturing.issue.report',
  'manufacturing.issue.acknowledge',
  'manufacturing.issue.resolve',
  'manufacturing.downtime.view',
  'manufacturing.downtime.manage',
]
for (const key of expectedPermissionKeys) {
  check(`Permission key defined: ${key}`, permissionsSrc.includes(`'${key}'`))
}
check(
  'useManufacturingPhase2bPermissions hook exported',
  permissionsSrc.includes('export function useManufacturingPhase2bPermissions'),
)

const permissionsIndexSrc = read('src/utils/permissions/index.ts')
check('permissions index re-exports phase2b hook', permissionsIndexSrc.includes('useManufacturingPhase2bPermissions'))

console.log('\nPages & components:')
const phase2bFiles: Array<[string, string]> = [
  ['My Work page', 'src/modules/manufacturing/operator/MyWorkPage.tsx'],
  ['Operator task card', 'src/modules/manufacturing/operator/OperatorTaskCard.tsx'],
  ['Operator task actions', 'src/modules/manufacturing/operator/OperatorTaskActions.tsx'],
  ['Production completion sheet', 'src/modules/manufacturing/operator/ProductionCompletionSheet.tsx'],
  ['Quick issue sheet', 'src/modules/manufacturing/operator/QuickIssueSheet.tsx'],
  ['Daily update page', 'src/modules/manufacturing/daily-update/DailyUpdatePage.tsx'],
  ['Daily production grid', 'src/modules/manufacturing/daily-update/DailyProductionGrid.tsx'],
  ['Issues queue page', 'src/modules/manufacturing/issues/IssuesQueuePage.tsx'],
  ['Issue status badge', 'src/modules/manufacturing/issues/IssueStatusBadge.tsx'],
  ['Assignment drawer', 'src/modules/manufacturing/work-orders/components/AssignmentDrawer.tsx'],
  ['Assignment history', 'src/modules/manufacturing/work-orders/components/AssignmentHistory.tsx'],
]
for (const [label, relPath] of phase2bFiles) {
  check(label, fileExists(relPath), relPath)
}

const myWorkSrc = read('src/modules/manufacturing/operator/MyWorkPage.tsx')
check('My Work uses t() i18n helper', myWorkSrc.includes("t('myWork.title')"))
check('My Work gates on isApiMode()', myWorkSrc.includes('isApiMode()'))
check('My Work renders OperatorTaskCard', myWorkSrc.includes('OperatorTaskCard'))

const dailySrc = read('src/modules/manufacturing/daily-update/DailyUpdatePage.tsx')
check('Daily Update page loads grid component', dailySrc.includes('DailyProductionGrid'))

console.log('\nRoutes:')
const routesSrc = read('src/routes/manufacturingRoutes.tsx')
check("Route registered: manufacturing/daily-update", routesSrc.includes("'manufacturing/daily-update'"))
check("Route registered: manufacturing/my-work", routesSrc.includes("'manufacturing/my-work'"))
check("Route registered: manufacturing/issues", routesSrc.includes("'manufacturing/issues'"))
check('No duplicate /production/my-jobs route', !routesSrc.includes("'production/my-jobs'"))

console.log('\nNavigation:')
const navSrc = read('src/config/navigation.ts')
check('Nav includes Daily Update link', navSrc.includes("path: '/manufacturing/daily-update'"))
check('Nav includes My Work link', navSrc.includes("path: '/manufacturing/my-work'"))
check('Nav includes Issues link', navSrc.includes("path: '/manufacturing/issues'"))
check('Nav preserves Setup group', navSrc.includes("group: 'Setup'"))

const woDetailSrc = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('Work order detail has Assignments tab', woDetailSrc.includes("'assignments'"))
check('Work order detail has Issues tab', woDetailSrc.includes("'issues'"))
check('Work order detail uses AssignmentDrawer', woDetailSrc.includes('AssignmentDrawer'))

const todaySrc = read('src/modules/manufacturing/today/TodayPage.tsx')
check('Today page handles openIssues field', todaySrc.includes('openIssues'))

console.log(`\n${failed === 0 ? '✓ All checks passed' : `✗ ${failed} check(s) failed`} (${passed} passed, ${failed} failed)\n`)
if (failed > 0) process.exit(1)
