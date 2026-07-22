/**
 * Phase 4D2 Money Out — AP reconciliation + close gate frontend verification.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

const RECON_PAGES = [
  'src/modules/accounting/money-out/reconciliation/PayableReconciliationPage.tsx',
  'src/modules/accounting/money-out/reconciliation/PayableReconciliationRunListPage.tsx',
  'src/modules/accounting/money-out/reconciliation/PayableReconciliationRunDetailPage.tsx',
  'src/modules/accounting/money-out/reconciliation/PayableReconciliationExceptionsPage.tsx',
  'src/modules/accounting/money-out/reconciliation/PayableReconciliationExceptionDetailPage.tsx',
  'src/modules/accounting/money-out/close-gate/PayableCloseGatePage.tsx',
  'src/modules/accounting/money-out/close-gate/PayableCloseGateRunDetailPage.tsx',
  'src/modules/accounting/money-out/MoneyOutOverviewPage.tsx',
]

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Money Out Reconciliation (Phase 4D2) verification')
  console.log('═══════════════════════════════════════\n')

  const { MONEY_OUT_WORKSPACE_TABS } = await import('../src/modules/accounting/money-out/moneyOutUi.ts')

  const liveTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && !('preview' in t && t.preview))

  check('Reconciliation tab live', liveTab('/accounting/money-out/reconciliation'))
  check('Close Gate tab live', liveTab('/accounting/money-out/close-gate'))
  check('Reconciliation not preview', !MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-out/reconciliation' && 'preview' in t))

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Reconciliation dashboard route', routesSrc.includes("path: 'accounting/money-out/reconciliation'"))
  check('Reconciliation runs route', routesSrc.includes("path: 'accounting/money-out/reconciliation/runs'"))
  check('Reconciliation run detail route', routesSrc.includes("path: 'accounting/money-out/reconciliation/runs/:id'"))
  check('Reconciliation exceptions route', routesSrc.includes("path: 'accounting/money-out/reconciliation/exceptions'"))
  check('Reconciliation exception detail route', routesSrc.includes("path: 'accounting/money-out/reconciliation/exceptions/:id'"))
  check('Close gate route', routesSrc.includes("path: 'accounting/money-out/close-gate'"))
  check('Close gate run detail route', routesSrc.includes("path: 'accounting/money-out/close-gate/runs/:id'"))

  const indexSrc = read('src/modules/accounting/money-out/index.ts')
  check('Index exports PayableReconciliationPage', indexSrc.includes('PayableReconciliationPage'))
  check('Index exports PayableCloseGatePage', indexSrc.includes('PayableCloseGatePage'))

  const typesSrc = read('src/types/moneyOut.ts')
  check('Types PayableReconciliationRunDto', typesSrc.includes('export interface PayableReconciliationRunDto'))
  check('Types PayableCloseGateRunDto', typesSrc.includes('export interface PayableCloseGateRunDto'))
  check('Types PayableReconciliationExceptionDto', typesSrc.includes('export interface PayableReconciliationExceptionDto'))

  const apiSrc = read('src/services/api/payablesApi.ts')
  check('API createPayableReconciliationRun', apiSrc.includes('createPayableReconciliationRun'))
  check('API listPayableReconciliationRuns', apiSrc.includes('listPayableReconciliationRuns'))
  check('API acknowledgePayableReconciliationException', apiSrc.includes('acknowledgePayableReconciliationException'))
  check('API exportPayableReconciliationRun', apiSrc.includes('exportPayableReconciliationRun'))
  check('API createPayableCloseGateRun', apiSrc.includes('createPayableCloseGateRun'))
  check('API getLatestPayableCloseGateRun', apiSrc.includes('getLatestPayableCloseGateRun'))
  check('API exportPayableCloseGateRun', apiSrc.includes('exportPayableCloseGateRun'))
  check('API reconciliation base path', apiSrc.includes("'/accounting/payables/reconciliation'"))
  check('API close gate base path', apiSrc.includes("'/accounting/payables/close-gate'"))
  check('API export uses apiDownloadBlob', apiSrc.includes('apiDownloadBlob'))

  const bridgeSrc = read('src/services/bridges/payablesApiBridge.ts')
  check('Bridge createPayableReconciliationRun', bridgeSrc.includes('export async function createPayableReconciliationRun'))
  check('Bridge listPayableReconciliationRuns', bridgeSrc.includes('export async function listPayableReconciliationRuns'))
  check('Bridge createPayableCloseGateRun', bridgeSrc.includes('export async function createPayableCloseGateRun'))
  check('Bridge exportPayableCloseGateRun', bridgeSrc.includes('export async function exportPayableCloseGateRun'))
  check('Bridge reconciliation requires API mode', bridgeSrc.includes('requireApiMode()'))

  const permsSrc = read('src/utils/permissions/moneyOut.ts')
  check('Permission canReconcileView', permsSrc.includes('canReconcileView'))
  check('Permission canReconcileRun', permsSrc.includes('canReconcileRun'))
  check('Permission canCloseGateView', permsSrc.includes('canCloseGateView'))
  check('Permission canCloseGateRun', permsSrc.includes('canCloseGateRun'))
  check('Permission finance.ap.reconciliation.view', permsSrc.includes("'finance.ap.reconciliation.view'"))
  check('Permission finance.ap.close_gate.export', permsSrc.includes("'finance.ap.close_gate.export'"))

  const shellSrc = read('src/modules/accounting/money-out/MoneyOutWorkspaceShell.tsx')
  check('Shell activePath reconciliation', shellSrc.includes("'/accounting/money-out/reconciliation'"))
  check('Shell activePath close-gate', shellSrc.includes("'/accounting/money-out/close-gate'"))

  const overviewSrc = read('src/modules/accounting/money-out/MoneyOutOverviewPage.tsx')
  check('Overview fetches latest recon', overviewSrc.includes('listPayableReconciliationRuns'))
  check('Overview recon status card', overviewSrc.includes('AP reconciliation'))

  const reconPageSrc = read('src/modules/accounting/money-out/reconciliation/PayableReconciliationPage.tsx')
  check('Reconciliation page uses bridge', reconPageSrc.includes('payablesApiBridge'))
  check('Reconciliation page no Close Period', !reconPageSrc.toLowerCase().includes('close period'))

  const closeGateSrc = read('src/modules/accounting/money-out/close-gate/PayableCloseGatePage.tsx')
  check('Close gate uses listPeriods', closeGateSrc.includes('listPeriods'))
  check('Close gate no Close Period button', !closeGateSrc.includes('Close Period'))

  const exceptionDetailSrc = read('src/modules/accounting/money-out/reconciliation/PayableReconciliationExceptionDetailPage.tsx')
  check('Exception detail uses appPromptNote', exceptionDetailSrc.includes('appPromptNote'))
  check('Exception detail acknowledge bridge', exceptionDetailSrc.includes('acknowledgePayableReconciliationException'))

  const pageSources = RECON_PAGES.map((p) => read(p))
  check('No Ant Design in recon pages', pageSources.every((f) => !f.includes('antd') && !f.includes('@ant-design')))
  check(
    'Recon pages use MoneyOutWorkspaceShell',
    pageSources.every((f) => f.includes('MoneyOutWorkspaceShell') || f.includes('payablesApiBridge')),
  )

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
