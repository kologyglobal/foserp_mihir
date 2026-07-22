/**
 * Manufacturing Phase 6A (Production Planning) smoke test.
 * Run: npm run test:manufacturing-phase6a
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

console.log('\n── Manufacturing Production Planning (Phase 6A) smoke ──\n')

console.log('Backend:')
check('routes file', fileExists('../backend/src/modules/manufacturing/plans/plan.routes.ts'))
check('service file', fileExists('../backend/src/modules/manufacturing/plans/plan.service.ts'))
check(
  'migration',
  fileExists('../backend/prisma/migrations/20260720250000_manufacturing_phase6a_production_plans/migration.sql'),
)
check('backend test', fileExists('../backend/tests/manufacturing-phase6a.test.ts'))
const mfgRoutes = read('../backend/src/modules/manufacturing/manufacturing.routes.ts')
check('mounted /plans', mfgRoutes.includes("'/plans'"))
const perms = read('../backend/src/constants/permissions.ts')
check('plan.create permission', perms.includes('manufacturing.production_plan.create'))
check('plan.release permission', perms.includes('manufacturing.production_plan.release'))

console.log('\nFrontend:')
check('API client plans', read('src/services/api/manufacturingApi.ts').includes('listProductionPlans'))
check('plan mapper', fileExists('src/services/manufacturing/productionPlanApiMapper.ts'))
check('dual-mode service', read('src/services/manufacturing/manufacturingService.ts').includes('listProductionPlans'))
check('plan register page', fileExists('src/modules/manufacturing/production-plan/ProductionPlanPage.tsx'))
check('5C acceptance doc', read('../docs/manufacturing/PRODUCTION_PHASE5C_README.md').includes('Accepted depth limits'))

console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`)
process.exit(failed > 0 ? 1 : 0)
