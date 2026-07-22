/**
 * Quality Phase 4A smoke — API client + route wiring (static).
 * npx tsx scripts/test-quality-phase4a.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let pass = 0
let fail = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  ok ? pass++ : fail++
}

const qualityApi = fs.readFileSync(path.join(root, 'src/services/api/qualityApi.ts'), 'utf8')
check('qualityApi exports listInspections', qualityApi.includes('export async function listInspections'))
check('qualityApi exports decideInspection', qualityApi.includes('export async function decideInspection'))
check('qualityApi exports getWorkOrderQualityBlockers', qualityApi.includes('export async function getWorkOrderQualityBlockers'))

const routes = fs.readFileSync(path.join(root, 'src/routes/qualityRoutes.tsx'), 'utf8')
check('qualityRoutes uses ApiQcQueuePage in API mode', routes.includes('ApiQcQueuePage') && routes.includes('isApiMode()'))

const woDetail = fs.readFileSync(path.join(root, 'src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx'), 'utf8')
check('ApiWorkOrderDetailPage loads quality blockers', woDetail.includes('getWorkOrderQualityBlockers'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
