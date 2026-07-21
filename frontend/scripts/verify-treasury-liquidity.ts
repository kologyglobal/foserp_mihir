/**
 * Smoke checks for Finance Phase 5C1 — treasury liquidity FE wiring.
 * Run: npx tsx scripts/verify-treasury-liquidity.ts
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

check('LiquidityDashboardPage exists', exists('src/modules/accounting/treasury/liquidity/pages/LiquidityDashboardPage.tsx'))
check('ApiLiquidityDashboardPage exists', exists('src/modules/accounting/treasury/liquidity/pages/ApiLiquidityDashboardPage.tsx'))
check('liquidity types exist', exists('src/modules/accounting/treasury/liquidity/api/treasury-liquidity.types.ts'))
check('liquidity api wrappers exist', exists('src/modules/accounting/treasury/liquidity/api/treasury-liquidity.api.ts'))

const routes = read('src/routes/accountingRoutes.tsx')
check('Route bank-cash → LiquidityDashboardPage', routes.includes("path: 'accounting/bank-cash'") && routes.includes('LiquidityDashboardPage'))
check('Route bank-cash/liquidity registered', routes.includes("path: 'accounting/bank-cash/liquidity'"))

const apiPage = read('src/modules/accounting/treasury/liquidity/pages/ApiLiquidityDashboardPage.tsx')
check('FE gates canViewLiquidity', apiPage.includes('canViewLiquidity'))
check('FE gates canManageClosing', apiPage.includes('canManageClosing'))
check('FE reopen day action', apiPage.includes('reopenDayClose') || apiPage.includes('onReopenDay'))

const treasuryApi = read('src/services/api/treasuryApi.ts')
check('treasuryApi cash-position', treasuryApi.includes('/liquidity/cash-position') || treasuryApi.includes('getTreasuryCashPosition'))
check('treasuryApi dashboard', treasuryApi.includes('getTreasuryLiquidityDashboard'))
check('treasuryApi day-close reopen', treasuryApi.includes('reopenTreasuryDayClose'))

const tabs = read('src/types/bankCash.ts')
check('Workspace tab liquidity', tabs.includes("id: 'liquidity'") || tabs.includes('/accounting/bank-cash/liquidity'))

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
