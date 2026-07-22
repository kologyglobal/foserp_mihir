/**
 * Manufacturing Phase 5C corrections smoke.
 * Run: npm run test:manufacturing-phase5c
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

console.log('\n── Manufacturing corrections (Phase 5C) smoke ──\n')
check('routes', exists('../backend/src/modules/manufacturing/corrections/correction.routes.ts'))
check('service', exists('../backend/src/modules/manufacturing/corrections/correction.service.ts'))
check('migration', exists('../backend/prisma/migrations/20260720240000_manufacturing_phase5c_corrections/migration.sql'))
check('backend test', exists('../backend/tests/manufacturing-phase5c.test.ts'))
check('mounted', read('../backend/src/modules/manufacturing/manufacturing.routes.ts').includes('/corrections'))
check('API listCorrections', read('src/services/api/manufacturingApi.ts').includes('listCorrections'))
check('CorrectionDrawer', exists('src/modules/manufacturing/corrections/CorrectionDrawer.tsx'))
check('Register page', exists('src/modules/manufacturing/corrections/CorrectionsRegisterPage.tsx'))
check('readme', exists('../docs/manufacturing/PRODUCTION_PHASE5C_README.md'))
console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
