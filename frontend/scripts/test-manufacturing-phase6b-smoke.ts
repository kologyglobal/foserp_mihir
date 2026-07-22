/**
 * Manufacturing Phase 6B (costing / GL flag) smoke test.
 * Run: npm run test:manufacturing-phase6b
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

console.log('\n── Manufacturing Costing / GL (Phase 6B) smoke ──\n')

console.log('Backend:')
check('event service', fileExists('../backend/src/modules/manufacturing/accounting/manufacturing-accounting-event.service.ts'))
check('gate service', fileExists('../backend/src/modules/manufacturing/accounting/manufacturing-accounting-gate.service.ts'))
check('builder', fileExists('../backend/src/modules/manufacturing/accounting/manufacturing-accounting-builder.service.ts'))
check('cost preview', fileExists('../backend/src/modules/manufacturing/accounting/manufacturing-cost-preview.service.ts'))
check(
  'migration',
  fileExists('../backend/prisma/migrations/20260720280000_manufacturing_phase6b_accounting_events/migration.sql'),
)
check('backend test', fileExists('../backend/tests/manufacturing-phase6b.test.ts'))
const mfgRoutes = read('../backend/src/modules/manufacturing/manufacturing.routes.ts')
check('mounted /accounting', mfgRoutes.includes("'/accounting'"))
const materialSvc = read('../backend/src/modules/manufacturing/materials/material.service.ts')
check('issue hooks event', materialSvc.includes('MATERIAL_ISSUED'))
const woRoutes = read('../backend/src/modules/manufacturing/work-orders/work-order.routes.ts')
check('costing preview route', woRoutes.includes('costing/preview'))
const schema = read('../backend/prisma/schema.prisma')
check('ProductionAccountingEvent model', schema.includes('model ProductionAccountingEvent'))
check('MANUFACTURING_ACCOUNTING enum', schema.includes('MANUFACTURING_ACCOUNTING'))

console.log('\nDocs:')
check('6B README', fileExists('../docs/manufacturing/PRODUCTION_PHASE6B_README.md'))

console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`)
process.exit(failed > 0 ? 1 : 0)
