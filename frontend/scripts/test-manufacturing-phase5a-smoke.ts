/**
 * Manufacturing Phase 5A (runtime changes) smoke test.
 * Run: npm run test:manufacturing-phase5a
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

console.log('\n── Manufacturing runtime changes (Phase 5A) smoke ──\n')

console.log('Backend:')
check('routes file', fileExists('../backend/src/modules/manufacturing/runtime-changes/runtime-change.routes.ts'))
check('service file', fileExists('../backend/src/modules/manufacturing/runtime-changes/runtime-change.service.ts'))
check('apply service', fileExists('../backend/src/modules/manufacturing/runtime-changes/runtime-change-apply.service.ts'))
check('migration', fileExists('../backend/prisma/migrations/20260720220000_manufacturing_phase5a_runtime_changes/migration.sql'))
check('backend test', fileExists('../backend/tests/manufacturing-phase5a.test.ts'))
const mfgRoutes = read('../backend/src/modules/manufacturing/manufacturing.routes.ts')
check('mounted under work-orders', mfgRoutes.includes("work-orders/:workOrderId/runtime-changes"))

console.log('\nAPI client:')
const api = read('src/services/api/manufacturingApi.ts')
for (const fn of [
  'listRuntimeChanges',
  'previewRuntimeChange',
  'createRuntimeChange',
  'submitRuntimeChange',
  'applyRuntimeChange',
  'approveRuntimeChange',
]) {
  check(`exports ${fn}`, api.includes(`export async function ${fn}(`))
}

console.log('\nUI:')
check('RuntimeChangeDrawer', fileExists('src/modules/manufacturing/work-orders/RuntimeChangeDrawer.tsx'))
check('types', fileExists('src/types/manufacturingRuntimeChange.ts'))
const detail = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('Change / Exception wired', detail.includes('RuntimeChangeDrawer') || detail.includes('Change / Exception') || detail.includes('runtimeChange'))
check('Changes tab', detail.toLowerCase().includes('changes') && detail.includes('listRuntimeChanges'))

console.log('\nDocs:')
check('phase 5a readme', fileExists('../docs/manufacturing/PRODUCTION_PHASE5A_README.md'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
