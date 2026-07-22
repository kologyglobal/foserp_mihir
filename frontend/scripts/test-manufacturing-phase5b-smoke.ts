/**
 * Manufacturing Phase 5B (WIP transfers) smoke test.
 * Run: npm run test:manufacturing-phase5b
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

console.log('\n── Manufacturing WIP transfers (Phase 5B) smoke ──\n')

console.log('Backend:')
check('routes file', fileExists('../backend/src/modules/manufacturing/wip-movements/wip-movement.routes.ts'))
check('service file', fileExists('../backend/src/modules/manufacturing/wip-movements/wip-movement.service.ts'))
check('migration', fileExists('../backend/prisma/migrations/20260720230000_manufacturing_phase5b_wip_transfers/migration.sql'))
check('backend test', fileExists('../backend/tests/manufacturing-phase5b.test.ts'))
const woRoutes = read('../backend/src/modules/manufacturing/work-orders/work-order.routes.ts')
check('mounted wip-movements', woRoutes.includes('wip-movements'))
check('mounted transfer-to', woRoutes.includes('transfer-to'))

console.log('\nAPI client:')
const api = read('src/services/api/manufacturingApi.ts')
for (const fn of ['listWipMovements', 'createWipMovement', 'transferToWorkOrder']) {
  check(`exports ${fn}`, api.includes(`export async function ${fn}(`))
}

console.log('\nUI:')
check('WipTransferDrawer', fileExists('src/modules/manufacturing/work-orders/WipTransferDrawer.tsx'))
check('types', fileExists('src/types/manufacturingWipMovement.ts'))
const detail = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('Transfer wired', detail.includes('WipTransferDrawer'))
check('Transfers list', detail.includes('listWipMovements'))

console.log('\nDocs:')
check('phase 5b readme', fileExists('../docs/manufacturing/PRODUCTION_PHASE5B_README.md'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
