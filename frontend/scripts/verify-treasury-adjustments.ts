/**
 * Finance Phase 5B3 — treasury adjustments / SI / books FE verification.
 * Run: npm run test:treasury-adjustments
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

console.log('═══════════════════════════════════════')
console.log(' Treasury Adjustments (Phase 5B3) verification')
console.log('═══════════════════════════════════════\n')

const pages = [
  'src/modules/accounting/treasury/adjustments/pages/AdjustmentListPage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/ApiAdjustmentListPage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/AdjustmentCreatePage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/ApiAdjustmentCreatePage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/AdjustmentDetailPage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/ApiAdjustmentDetailPage.tsx',
  'src/modules/accounting/treasury/adjustments/pages/BankPostingRuleListPage.tsx',
  'src/modules/accounting/treasury/standing-instructions/pages/SIListPage.tsx',
  'src/modules/accounting/treasury/standing-instructions/pages/ApiSIListPage.tsx',
  'src/modules/accounting/treasury/standing-instructions/pages/SICreatePage.tsx',
  'src/modules/accounting/treasury/standing-instructions/pages/SIDetailPage.tsx',
  'src/modules/accounting/treasury/books/pages/BankbookPage.tsx',
  'src/modules/accounting/treasury/books/pages/CashbookPage.tsx',
  'src/modules/accounting/treasury/books/pages/ApiBookPage.tsx',
]
for (const p of pages) check(`File exists: ${p}`, exists(p))

check('Types: treasury-adjustment.types.ts', exists('src/modules/accounting/treasury/adjustments/api/treasury-adjustment.types.ts'))
check('Types: standing-instruction.types.ts', exists('src/modules/accounting/treasury/standing-instructions/api/standing-instruction.types.ts'))
check('Types: treasury-books.types.ts', exists('src/modules/accounting/treasury/books/api/treasury-books.types.ts'))
check('Permissions hook', exists('src/utils/permissions/treasuryAdjustment.ts'))

const routes = read('src/routes/accountingRoutes.tsx')
check('Route treasury-adjustments', routes.includes("path: 'accounting/bank-cash/treasury-adjustments'"))
check('Route treasury-adjustments/new', routes.includes("path: 'accounting/bank-cash/treasury-adjustments/new'"))
check('Route standing-instructions', routes.includes("path: 'accounting/bank-cash/standing-instructions'"))
check('Route posting-rules', routes.includes("path: 'accounting/bank-cash/posting-rules'"))
check('Route bankbook', routes.includes("path: 'accounting/bank-cash/bankbook'"))
check('Route cashbook', routes.includes("path: 'accounting/bank-cash/cashbook'"))

const tabs = read('src/types/bankCash.ts')
check('Tab Bank Transactions', tabs.includes("id: 'treasury_adjustments'"))
check('Tab Standing Instructions', tabs.includes("id: 'standing_instructions'"))
check('Tab Posting Rules', tabs.includes("id: 'posting_rules'"))
check('Tab Bankbook', tabs.includes("id: 'bank_book'") && tabs.includes('/accounting/bank-cash/bankbook'))

const api = read('src/services/api/treasuryApi.ts')
check('API listTreasuryAdjustments', api.includes('listTreasuryAdjustments') || api.includes('/treasury-adjustments'))
check('API create from statement', api.includes('treasury-adjustment') && api.includes('lines/'))
check('API standing-instructions', api.includes('/standing-instructions'))
check('API books bankbook', api.includes('getBankbook') && api.includes('/bankbook'))
check('API books cashbook', api.includes('getCashbook') && api.includes('/cashbook'))

const settings = read('src/types/financeSetup.ts')
check('FinanceSettings useTreasuryAdjustmentsForStatementItems', settings.includes('useTreasuryAdjustmentsForStatementItems'))
check('FinanceSettings treasuryAdjustmentApprovalLimit', settings.includes('treasuryAdjustmentApprovalLimit'))

const features = read('src/modules/accounting/settings/FeaturesPage.tsx')
check('FeaturesPage binds statement flag', features.includes('useTreasuryAdjustmentsForStatementItems'))
check('FeaturesPage binds adjustment approval limit', features.includes('treasuryAdjustmentApprovalLimit'))

const drawer = read('src/modules/accounting/treasury/bank-reconciliation/components/CreateBankTransactionDrawer.tsx')
check('Statement drawer Create Bank Transaction', drawer.includes('Create Bank Transaction') && drawer.includes('createAdjustmentFromStatementLine'))

const recon = read('src/modules/accounting/treasury/bank-reconciliation/pages/ReconciliationWorkspacePage.api.tsx')
check('Recon workspace gates Create Bank Transaction on flag', recon.includes('useTreasuryAdjustments') && recon.includes('getFinanceSettings'))

const stmtSvc = read('../backend/src/modules/accounting/treasury/adjustments/treasury-adjustment-statement.service.ts')
check('BE enforces useTreasuryAdjustmentsForStatementItems', stmtSvc.includes('useTreasuryAdjustmentsForStatementItems') && stmtSvc.includes('StatementPathDisabled'))

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
