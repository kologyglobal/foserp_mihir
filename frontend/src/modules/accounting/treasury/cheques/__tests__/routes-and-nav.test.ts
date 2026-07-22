/**
 * Finance Phase 5B2 — treasury cheque route wiring + Bank & Cash navigation checks.
 * Static route source-string + file-existence checks (no test renderer available in this repo's
 * lightweight harness) — mirrors `treasury/transfers/__tests__/routes-and-nav.test.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
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

function exists(rel: string) {
  return existsSync(path.join(ROOT, rel))
}

export function runChequeRoutesAndNavTests() {
  const routesSrc = read('frontend/src/routes/accountingRoutes.tsx')
  check('List route wired', routesSrc.includes("path: 'accounting/bank-cash/cheques'"))
  check('New route wired', routesSrc.includes("path: 'accounting/bank-cash/cheques/new'"))
  check('Detail route uses :id param', routesSrc.includes("path: 'accounting/bank-cash/cheques/:id'"))
  check('Routes import module barrel', routesSrc.includes("from '@/modules/accounting/treasury/cheques'"))
  check('Legacy demo ChequeManagementPage import removed from routes', !routesSrc.includes("from '@/modules/accounting/ChequeManagementPage'"))

  const listIdx = routesSrc.indexOf("path: 'accounting/bank-cash/cheques'")
  const newIdx = routesSrc.indexOf("path: 'accounting/bank-cash/cheques/new'")
  const dynamicIdx = routesSrc.lastIndexOf("path: 'accounting/bank-cash/cheques/:id'")
  check('Static routes declared before dynamic :id route', listIdx > 0 && newIdx > listIdx && dynamicIdx > newIdx)

  const uiSrc = read('frontend/src/modules/accounting/treasury/bank-statements/utils/bankStatementUi.ts')
  check('Cheques promoted to live links', uiSrc.includes("label: 'Cheques', path: '/accounting/bank-cash/cheques'"))
  check('Cheques removed from preview links', !uiSrc.includes("label: 'Cheques', path: '/accounting/bank-cash/cheques', preview: true"))

  const shellSrc = read('frontend/src/modules/accounting/treasury/cheques/components/ChequeWorkspaceShell.tsx')
  check('Workspace shell uses Bank & Cash workspace tabs', shellSrc.includes('BankCashWorkspaceTabs'))
  check('Workspace shell active tab is cheques', shellSrc.includes("active=\"cheques\""))

  const indexSrc = read('frontend/src/modules/accounting/treasury/cheques/index.ts')
  for (const exportName of ['ChequeListPage', 'ChequeCreatePage', 'ChequeDetailPage']) {
    check(`Module index exports ${exportName}`, indexSrc.includes(exportName))
  }

  const listPageSrc = read('frontend/src/modules/accounting/treasury/cheques/pages/ChequeListPage.tsx')
  check('List wrapper preserves demo mode', listPageSrc.includes('isApiMode') && listPageSrc.includes('DemoChequeManagementPage'))

  const actionBarSrc = read('frontend/src/modules/accounting/treasury/cheques/components/ChequeActionBar.tsx')
  for (const action of ['submit', 'approve', 'reject', 'issue', 'deposit', 'clear', 'bounce', 'stop', 'cancel', 'reverse']) {
    check(`Action bar wires ${action}`, actionBarSrc.toLowerCase().includes(action))
  }

  const apiClientSrc = read('frontend/src/services/api/treasuryApi.ts')
  for (const fn of [
    'listTreasuryCheques',
    'getTreasuryCheque',
    'createTreasuryCheque',
    'updateTreasuryCheque',
    'validateTreasuryCheque',
    'submitTreasuryCheque',
    'approveTreasuryCheque',
    'rejectTreasuryCheque',
    'reviseTreasuryCheque',
    'markTreasuryChequeReady',
    'cancelTreasuryCheque',
    'issueTreasuryCheque',
    'depositTreasuryCheque',
    'clearTreasuryCheque',
    'bounceTreasuryCheque',
    'stopTreasuryCheque',
    'reverseTreasuryCheque',
  ]) {
    check(`treasuryApi exports ${fn}`, apiClientSrc.includes(`export async function ${fn}`))
  }

  const requiredFiles = [
    'frontend/src/modules/accounting/treasury/cheques/api/treasury-cheque.types.ts',
    'frontend/src/modules/accounting/treasury/cheques/api/treasury-cheque.api.ts',
    'frontend/src/modules/accounting/treasury/cheques/hooks/useChequeList.ts',
    'frontend/src/modules/accounting/treasury/cheques/hooks/useChequeDetail.ts',
    'frontend/src/modules/accounting/treasury/cheques/hooks/useChequeMutations.ts',
    'frontend/src/modules/accounting/treasury/cheques/components/ChequeStatusChip.tsx',
    'frontend/src/modules/accounting/treasury/cheques/components/ChequeWorkspaceShell.tsx',
    'frontend/src/modules/accounting/treasury/cheques/components/ChequeActionBar.tsx',
    'frontend/src/modules/accounting/treasury/cheques/components/ChequeForm.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ChequeListPage.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ChequeCreatePage.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ChequeDetailPage.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ApiChequeListPage.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ApiChequeCreatePage.tsx',
    'frontend/src/modules/accounting/treasury/cheques/pages/ApiChequeDetailPage.tsx',
    'frontend/src/modules/accounting/ChequeManagementPage.tsx',
    'frontend/src/utils/permissions/treasuryCheque.ts',
    'docs/accounting/TREASURY_CHEQUE_FRONTEND.md',
  ]
  for (const file of requiredFiles) {
    check(`File exists: ${file}`, exists(file))
  }

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('routes-and-nav.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Treasury Cheques — routes & nav')
  console.log('═══════════════════════════════════════\n')
  const result = runChequeRoutesAndNavTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
