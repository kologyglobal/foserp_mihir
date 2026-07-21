/**
 * Phase 5A3 — reconciliation route wiring + Bank & Cash navigation checks.
 * Static route source-string checks (no test renderer available in this repo's lightweight harness).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

export function runReconciliationRoutesAndNavTests() {
  const routesSrc = read('frontend/src/routes/accountingRoutes.tsx')
  check('List route wired', routesSrc.includes("path: 'accounting/bank-cash/reconciliation'"))
  check('History route wired', routesSrc.includes("path: 'accounting/bank-cash/reconciliation/history'"))
  check('Exceptions route wired', routesSrc.includes("path: 'accounting/bank-cash/reconciliation/exceptions'"))
  check('Match detail route wired', routesSrc.includes("path: 'accounting/bank-cash/reconciliation/matches/:matchId'"))
  check('Workspace route uses :statementId param', routesSrc.includes("path: 'accounting/bank-cash/reconciliation/:statementId'"))
  check('Legacy reconcile deep-link redirect preserved', routesSrc.includes('accounting/bank/:bankAccountId/reconcile'))

  // React Router v6.4+ createBrowserRouter ranks static segments over dynamic ones regardless of
  // array order, but keep the static routes declared first for readability/debuggability.
  const historyIdx = routesSrc.indexOf("path: 'accounting/bank-cash/reconciliation/history'")
  const dynamicIdx = routesSrc.indexOf("path: 'accounting/bank-cash/reconciliation/:statementId'")
  check('History route declared before dynamic :statementId route', historyIdx > 0 && historyIdx < dynamicIdx)

  const overviewSrc = read('frontend/src/modules/accounting/BankCashOverviewPage.tsx')
  check('Overview imports live/preview links', overviewSrc.includes('BANK_STATEMENT_LIVE_LINKS'))

  const uiSrc = read('frontend/src/modules/accounting/treasury/bank-statements/utils/bankStatementUi.ts')
  check('Reconciliation promoted to live links', uiSrc.includes("label: 'Reconciliation'") && !uiSrc.includes("label: 'Matching'"))
  check('Reconciliation History promoted to live links', uiSrc.includes("label: 'Reconciliation History'"))
  check('Reconciliation Exceptions promoted to live links', uiSrc.includes("label: 'Reconciliation Exceptions'"))
  check('Cheques promoted to live links', uiSrc.includes("label: 'Cheques', path: '/accounting/bank-cash/cheques'"))
  check('Transfers remain preview', uiSrc.includes("label: 'Transfers'"))

  const detailSrc = read('frontend/src/modules/accounting/treasury/bank-statements/pages/BankStatementDetailPage.api.tsx')
  check('Open Reconciliation button wired on statement detail', detailSrc.includes('Open Reconciliation'))
  check('Open Reconciliation gated by RECONCILABLE_STATEMENT_STATUSES', detailSrc.includes('RECONCILABLE_STATEMENT_STATUSES'))
  check('Open Reconciliation gated by reconciliation view permission', detailSrc.includes('reconPerms.canView'))

  const shellSrc = read('frontend/src/modules/accounting/treasury/bank-reconciliation/components/ReconciliationWorkspaceShell.tsx')
  check('Workspace shell uses Bank & Cash workspace tabs', shellSrc.includes('BankCashWorkspaceTabs'))
  check('Workspace shell uses reconciliation sub-nav', shellSrc.includes('RECONCILIATION_LIVE_LINKS'))

  const indexSrc = read('frontend/src/modules/accounting/treasury/bank-reconciliation/index.ts')
  for (const exportName of [
    'ReconciliationListPage',
    'ReconciliationWorkspacePage',
    'ReconciliationMatchDetailPage',
    'ReconciliationHistoryPage',
    'ReconciliationExceptionsPage',
  ]) {
    check(`Module index exports ${exportName}`, indexSrc.includes(exportName))
  }

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('routes-and-nav.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Reconciliation — routes & nav')
  console.log('═══════════════════════════════════════\n')
  const result = runReconciliationRoutesAndNavTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
