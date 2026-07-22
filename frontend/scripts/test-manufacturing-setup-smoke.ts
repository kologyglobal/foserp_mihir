/**
 * Manufacturing Phase 1 setup screens smoke test — file existence + route/nav wiring.
 * Run: npm run test:manufacturing-setup
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

console.log('\n── Manufacturing setup (Phase 1) smoke ──\n')

console.log('Types & API service:')
check('manufacturingSetup types file exists', fileExists('src/types/manufacturingSetup.ts'))
check('manufacturingApi service file exists', fileExists('src/services/api/manufacturingApi.ts'))

console.log('\nPermissions:')
const permissionsSrc = readFileSync(path.join(ROOT, 'src/utils/permissions/manufacturing.ts'), 'utf8')
check('setup.view permission defined', permissionsSrc.includes('manufacturing.setup.view'))
check('profile permissions defined', permissionsSrc.includes('manufacturing.profile.view') && permissionsSrc.includes('manufacturing.profile.manage'))
check('work_centre permissions defined', permissionsSrc.includes('manufacturing.work_centre.view') && permissionsSrc.includes('manufacturing.work_centre.manage'))
check('machine permissions defined', permissionsSrc.includes('manufacturing.machine.view') && permissionsSrc.includes('manufacturing.machine.manage'))
check('useManufacturingSetupPermissions hook exported', permissionsSrc.includes('export function useManufacturingSetupPermissions'))

const permissionsIndexSrc = readFileSync(path.join(ROOT, 'src/utils/permissions/index.ts'), 'utf8')
check('permissions index re-exports setup hook', permissionsIndexSrc.includes('useManufacturingSetupPermissions'))

console.log('\nShell & pages:')
const setupPages: Array<[string, string]> = [
  ['Shared shell', 'src/modules/manufacturing/setup/ManufacturingSetupShell.tsx'],
  ['Setup hub page', 'src/modules/manufacturing/setup/SetupHubPage.tsx'],
  ['Work centres page', 'src/modules/manufacturing/setup/WorkCentresSetupPage.tsx'],
  ['Machines page', 'src/modules/manufacturing/setup/MachinesSetupPage.tsx'],
  ['Profiles page', 'src/modules/manufacturing/setup/ProfilesSetupPage.tsx'],
  ['Lookup hook', 'src/modules/manufacturing/setup/useSetupLookups.ts'],
  ['BOMs setup page', 'src/modules/manufacturing/setup/boms/BomsSetupPage.tsx'],
  ['BOM version editor page', 'src/modules/manufacturing/setup/boms/BomVersionEditorPage.tsx'],
  ['Routings setup page', 'src/modules/manufacturing/setup/routings/RoutingsSetupPage.tsx'],
  ['Routing version editor page', 'src/modules/manufacturing/setup/routings/RoutingVersionEditorPage.tsx'],
]
for (const [label, relPath] of setupPages) {
  check(label, fileExists(relPath), relPath)
}

console.log('\nRoutes:')
const routesSrc = readFileSync(path.join(ROOT, 'src/routes/manufacturingRoutes.tsx'), 'utf8')
const expectedRoutePaths = [
  'manufacturing/setup',
  'manufacturing/profiles',
  'manufacturing/work-centres',
  'manufacturing/machines',
  'manufacturing/setup/boms',
  'manufacturing/setup/boms/:bomId',
  'manufacturing/setup/bom-versions/:versionId',
  'manufacturing/setup/routings',
  'manufacturing/setup/routings/:routingId',
  'manufacturing/setup/routing-versions/:versionId',
]
for (const routePath of expectedRoutePaths) {
  check(`Route registered: ${routePath}`, routesSrc.includes(`'${routePath}'`))
}
check('Existing demo BOM route preserved', routesSrc.includes("'manufacturing/bom'"))
check('Existing demo Routes route preserved', routesSrc.includes("'manufacturing/routes'"))

const routeIndexSrc = readFileSync(path.join(ROOT, 'src/routes/index.tsx'), 'utf8')
check('index registers manufacturingRouteChildren', routeIndexSrc.includes('...manufacturingRouteChildren'))

console.log('\nNavigation:')
const navSrc = readFileSync(path.join(ROOT, 'src/config/navigation.ts'), 'utf8')
check('Nav includes Setup link', navSrc.includes("path: '/manufacturing/setup'"))
check('Nav includes Profiles link', navSrc.includes("path: '/manufacturing/profiles'"))
check('Nav includes Work Centres link', navSrc.includes("path: '/manufacturing/work-centres'"))
check('Nav includes Machines link', navSrc.includes("path: '/manufacturing/machines'"))
check('Nav preserves demo BOM link', navSrc.includes("path: '/manufacturing/bom'"))
check('Nav preserves demo Routes link', navSrc.includes("path: '/manufacturing/routes'"))

console.log(`\n${failed === 0 ? '✓ All checks passed' : `✗ ${failed} check(s) failed`} (${passed} passed, ${failed} failed)\n`)
if (failed > 0) process.exit(1)
