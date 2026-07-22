/**
 * Finance Phase 5B1 — transfer route wiring + Bank & Cash navigation checks.
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

export function runTransferRoutesAndNavTests() {
  const routesSrc = read('frontend/src/routes/accountingRoutes.tsx')
  check('List route wired', routesSrc.includes("path: 'accounting/bank-cash/transfers'"))
  check('New route wired', routesSrc.includes("path: 'accounting/bank-cash/transfers/new'"))
  check('In Transit route wired', routesSrc.includes("path: 'accounting/bank-cash/transfers/in-transit'"))
  check('Approvals route wired', routesSrc.includes("path: 'accounting/bank-cash/transfers/approvals'"))
  check('Edit route uses :id param', routesSrc.includes("path: 'accounting/bank-cash/transfers/:id/edit'"))
  check('Detail route uses :id param', routesSrc.includes("path: 'accounting/bank-cash/transfers/:id'"))
  check('Routes import module barrel', routesSrc.includes("from '@/modules/accounting/treasury/transfers'"))

  const listIdx = routesSrc.indexOf("path: 'accounting/bank-cash/transfers'")
  const newIdx = routesSrc.indexOf("path: 'accounting/bank-cash/transfers/new'")
  const inTransitIdx = routesSrc.indexOf("path: 'accounting/bank-cash/transfers/in-transit'")
  const editIdx = routesSrc.indexOf("path: 'accounting/bank-cash/transfers/:id/edit'")
  const dynamicIdx = routesSrc.lastIndexOf("path: 'accounting/bank-cash/transfers/:id'")
  check(
    'Static routes declared before dynamic :id routes',
    listIdx > 0 && newIdx > listIdx && inTransitIdx > 0 && editIdx > 0 && dynamicIdx > editIdx,
  )

  const uiSrc = read('frontend/src/modules/accounting/treasury/bank-statements/utils/bankStatementUi.ts')
  check('Transfers promoted to live links', uiSrc.includes("label: 'Transfers', path: '/accounting/bank-cash/transfers'"))
  check('Transfers In Transit promoted to live links', uiSrc.includes("label: 'Transfers In Transit'"))
  check('Transfers removed from preview links', !uiSrc.includes("label: 'Transfers', path: '/accounting/bank-cash/transfers', preview: true"))
  check('Cheques promoted to live links', uiSrc.includes("label: 'Cheques', path: '/accounting/bank-cash/cheques'"))

  const overviewSrc = read('frontend/src/modules/accounting/BankCashOverviewPage.tsx')
  check('Overview wires transfer overview counts hook', overviewSrc.includes('useTransferOverviewCounts'))
  check('Overview links to pending-approval filtered list', overviewSrc.includes('status=PENDING_APPROVAL'))
  check('Overview links to In Transit sub-page', overviewSrc.includes("/accounting/bank-cash/transfers/in-transit"))

  const shellSrc = read('frontend/src/modules/accounting/treasury/transfers/components/TransferWorkspaceShell.tsx')
  check('Workspace shell uses Bank & Cash workspace tabs', shellSrc.includes('BankCashWorkspaceTabs'))
  check('Workspace shell uses transfer sub-nav', shellSrc.includes('TRANSFER_LIVE_LINKS'))

  const indexSrc = read('frontend/src/modules/accounting/treasury/transfers/index.ts')
  for (const exportName of [
    'TransferListPage',
    'TransferCreatePage',
    'TransferEditPage',
    'TransferDetailPage',
    'TransferInTransitPage',
    'TransferApprovalsPage',
  ]) {
    check(`Module index exports ${exportName}`, indexSrc.includes(exportName))
  }

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('routes-and-nav.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Treasury Transfers — routes & nav')
  console.log('═══════════════════════════════════════\n')
  const result = runTransferRoutesAndNavTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
