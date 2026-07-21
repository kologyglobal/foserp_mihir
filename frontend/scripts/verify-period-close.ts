/**
 * Period Close Phase 1 — static verification (routes, dual-mode wiring, permissions).
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

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Period Close Phase 1 verification')
  console.log('═══════════════════════════════════════\n')

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Dashboard route', routesSrc.includes("path: 'accounting/period-close'"))
  check('Checklist route', routesSrc.includes("path: 'accounting/period-close/checklist'"))
  check('Period locking route', routesSrc.includes("path: 'accounting/period-close/period-locking'"))

  const serviceSrc = read('src/services/accounting/periodCloseService.ts')
  check('Service dual-mode isApiMode', serviceSrc.includes('isApiMode()'))
  check('Service getCloseDashboard API branch', serviceSrc.includes('buildApiCloseDashboard'))
  check('Service closeAccountingPeriod export', serviceSrc.includes('export async function closeAccountingPeriod'))
  check('Service reopenAccountingPeriod export', serviceSrc.includes('export async function reopenAccountingPeriod'))
  check('Demo seed still used when not API', serviceSrc.includes('buildCloseDashboard'))

  const composerSrc = read('src/services/accounting/periodCloseApiComposer.ts')
  check('Composer AP close gate', composerSrc.includes('getLatestPayableCloseGateRun'))
  check('Composer unposted journals', composerSrc.includes('listJournals'))
  check('Composer bank recon', composerSrc.includes('fetchReconciliationSessions'))
  check('Composer uses finance bridge close', composerSrc.includes('bridgeClosePeriod'))
  check('No new accounting.period_close BE perms invented', !composerSrc.includes('accounting.period_close.'))

  const bridgeSrc = read('src/services/bridges/financeApiBridge.ts')
  check('Bridge closePeriod', bridgeSrc.includes('export async function closePeriod'))
  check('Bridge reopenPeriod', bridgeSrc.includes('export async function reopenPeriod'))
  check('Bridge markPeriodUnderReview', bridgeSrc.includes('export async function markPeriodUnderReview'))
  check('Bridge listPeriods limit 100', bridgeSrc.includes('limit: 100'))

  const apiSrc = read('src/services/api/financeApi.ts')
  check('API path /accounting/periods', apiSrc.includes("'/accounting/periods'"))
  check('API close path', apiSrc.includes('/close'))
  check('API reopen path', apiSrc.includes('/reopen'))
  check('API mark-under-review path', apiSrc.includes('/mark-under-review'))

  const permsSrc = read('src/utils/permissions/periodClose.ts')
  check('Permissions map finance.period.view', permsSrc.includes('finance.period.view'))
  check('Permissions map finance.period.close', permsSrc.includes('finance.period.close'))
  check('Permissions map finance.period.reopen', permsSrc.includes('finance.period.reopen'))
  check('Permissions API mode flag', permsSrc.includes('isApiMode: true'))

  const lockingSrc = read('src/modules/accounting/period-close/ControlPages.tsx')
  check('Locking page closeAccountingPeriod', lockingSrc.includes('closeAccountingPeriod'))
  check('Locking page reopenAccountingPeriod', lockingSrc.includes('reopenAccountingPeriod'))
  check('Locking page mark under review', lockingSrc.includes('markAccountingPeriodUnderReview'))
  check('Locking page keeps demo module locks', lockingSrc.includes('updateModuleLock'))

  const dashSrc = read('src/modules/accounting/period-close/CloseDashboardPage.tsx')
  check('Dashboard uses getCloseDashboard', dashSrc.includes('getCloseDashboard'))

  const checklistSrc = read('src/modules/accounting/period-close/ChecklistAndReconPages.tsx')
  check('Checklist uses isApiMode', checklistSrc.includes('isApiMode'))
  check('Checklist computed actions in API', checklistSrc.includes('Computed'))

  const bannerSrc = read('src/components/accounting/period-close/PeriodClosePreviewBanner.tsx')
  check('Banner dual-mode', bannerSrc.includes('Period Close Phase 1 (API)'))

  const statusDoc = read('../docs/accounting/PERIOD_CLOSE_STATUS.md')
  check('Status doc Phase 1 shipped', statusDoc.includes('Phase 1'))
  check('Status doc Phase 2 deferred', statusDoc.includes('Phase 2'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
