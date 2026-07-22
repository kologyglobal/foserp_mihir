/**
 * Smoke checks for Budgeting Phase 1 dual-mode FE wiring.
 * Run: npx tsx scripts/verify-budgeting.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`✓ ${label}`)
    passed += 1
  } else {
    console.log(`✗ ${label}`)
    failed += 1
  }
}

function exists(rel: string) {
  return fs.existsSync(path.join(root, rel))
}

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

check('budgetingApi exists', exists('src/services/api/budgetingApi.ts'))
check('budgeting permissions hook', exists('src/utils/permissions/budgeting.ts'))
check('Phase1 N/A banner', exists('src/components/accounting/budgeting/BudgetingPhase1NaBanner.tsx'))

const service = read('src/services/accounting/budgetingService.ts')
check('dual-mode isApiMode', service.includes('isApiMode()'))
check('overview API path', service.includes('fetchBudgetingOverview'))
check('versions API', service.includes('createBudgetVersionApi') || service.includes('fetchBudgetVersions'))
check('annual lines API', service.includes('fetchBudgetLines'))
check('BVA API', service.includes('fetchBudgetVsActual'))

const capex = read('src/modules/accounting/budgeting/CapexBudgetPages.tsx')
check('Capex Phase1 banner', capex.includes('BudgetingPhase1NaBanner'))
const rolling = read('src/modules/accounting/budgeting/RollingForecastPage.tsx')
check('Rolling Phase1 banner', rolling.includes('BudgetingPhase1NaBanner'))
const cash = read('src/modules/accounting/budgeting/CashFlowForecastPage.tsx')
check('Cash flow Phase1 banner', cash.includes('BudgetingPhase1NaBanner'))

const routes = read('src/routes/accountingRoutes.tsx')
check('budgeting overview route', routes.includes('BudgetingOverviewPage') || routes.includes('accounting/budgeting'))

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
