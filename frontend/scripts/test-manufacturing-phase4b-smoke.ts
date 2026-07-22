/**
 * Manufacturing Phase 4B (Job Work / subcontracting) smoke test.
 * Run: npm run test:manufacturing-phase4b
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

console.log('\n── Manufacturing Job Work (Phase 4B) smoke ──\n')

console.log('Backend module:')
check('job-work routes exist', fileExists('../backend/src/modules/manufacturing/job-work/job-work.routes.ts'))
check('job-work service exists', fileExists('../backend/src/modules/manufacturing/job-work/job-work.service.ts'))
check('phase 4b backend test exists', fileExists('../backend/tests/manufacturing-phase4b.test.ts'))
check('phase 4b migration exists', fileExists('../backend/prisma/migrations/20260720210000_manufacturing_phase4b_job_work/migration.sql'))

console.log('\nAPI client:')
const apiSrc = read('src/services/api/manufacturingApi.ts')
for (const fn of [
  'listJobWorkOrders',
  'getJobWorkOrder',
  'createJobWorkOrder',
  'dispatchJobWorkOrder',
  'receiveJobWorkOrder',
  'reconcileJobWorkOrder',
  'closeJobWorkOrder',
  'cancelJobWorkOrder',
]) {
  check(`API client exports ${fn}`, apiSrc.includes(`export async function ${fn}(`))
}

console.log('\nDual-mode service:')
const svc = read('src/services/manufacturing/jobWorkService.ts')
check('jobWorkService branches isApiMode', svc.includes('isApiMode()'))
check('mapper file exists', fileExists('src/services/manufacturing/jobWorkApiMapper.ts'))

console.log('\nUI:')
const form = read('src/modules/manufacturing/job-work/JobWorkFormPage.tsx')
check('form supports API mode masters', form.includes('isApiMode') && form.includes('materialWarehouseId'))
check('register page uses getJobWorkOrders', read('src/modules/manufacturing/job-work/JobWorkRegisterPage.tsx').includes('getJobWorkOrders'))

console.log('\nDocs:')
check('phase 4b readme exists', fileExists('../docs/manufacturing/PRODUCTION_PHASE4B_README.md'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
