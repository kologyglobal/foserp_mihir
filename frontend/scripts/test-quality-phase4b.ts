/**
 * Quality Phase 4B smoke — API client + dual-mode routes (static).
 * npx tsx scripts/test-quality-phase4b.ts
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
check('qualityApi exports listQcParameters', qualityApi.includes('export async function listQcParameters'))
check('qualityApi exports createInspectionPlan', qualityApi.includes('export async function createInspectionPlan'))
check('qualityApi decideInspection supports parameterResults', qualityApi.includes('parameterResults'))

const routes = fs.readFileSync(path.join(root, 'src/routes/qualityRoutes.tsx'), 'utf8')
check('qualityRoutes API parameters master', routes.includes('ApiQcParameterMasterPage') && routes.includes('isApiMode()'))
check('qualityRoutes API inspection plans', routes.includes('ApiInspectionPlanMasterPage'))
check('qualityRoutes API inspection detail', routes.includes('ApiQcInspectionDetailPage'))

const masters = fs.readFileSync(path.join(root, 'src/modules/quality/ApiQcMasterPages.tsx'), 'utf8')
check('ApiQcMasterPages present', masters.includes('ApiQcParameterMasterPage'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
