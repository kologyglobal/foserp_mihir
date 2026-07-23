/**
 * Period Close — static verification (Phase 1 + Close Control Hardening).
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
  console.log(' Period Close verification')
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
  check('Service checklist acks', serviceSrc.includes('saveCloseChecklistAcks'))
  check('Service bank live readiness', serviceSrc.includes('composePeriodCloseReadiness(periodFilter)'))
  check('Demo seed still used when not API', serviceSrc.includes('buildCloseDashboard'))

  const composerSrc = read('src/services/accounting/periodCloseApiComposer.ts')
  check('Composer uses close-readiness API', composerSrc.includes('getPeriodCloseReadiness'))
  check('Composer uses finance bridge close', composerSrc.includes('bridgeClosePeriod'))
  check('Composer checklist ack helpers', composerSrc.includes('apiUpsertChecklistAcks'))
  check('No new accounting.period_close BE perms invented', !composerSrc.includes('accounting.period_close.'))

  const apiSrc = read('src/services/api/financeApi.ts')
  check('API path /accounting/periods', apiSrc.includes("'/accounting/periods'"))
  check('API close-readiness path', apiSrc.includes('/close-readiness'))
  check('API checklist-acks path', apiSrc.includes('/checklist-acks'))
  check('API close path', apiSrc.includes('/close'))
  check('API reopen path', apiSrc.includes('/reopen'))

  const beRoutes = read('../backend/src/modules/accounting/accounting-periods/accounting-period.routes.ts')
  check('BE close-readiness route', beRoutes.includes('close-readiness'))
  check('BE checklist-acks route', beRoutes.includes('checklist-acks'))

  const beReadiness = read('../backend/src/modules/accounting/accounting-periods/period-close-readiness.service.ts')
  check('BE assertCloseAllowed', beReadiness.includes('assertCloseAllowed'))
  check('BE PERIOD_CLOSE_BLOCKED', beReadiness.includes('PERIOD_CLOSE_BLOCKED'))

  const permsSrc = read('src/utils/permissions/periodClose.ts')
  check('Permissions map finance.period.view', permsSrc.includes('finance.period.view'))
  check('Permissions map finance.period.close', permsSrc.includes('finance.period.close'))
  check('Permissions map finance.period.reopen', permsSrc.includes('finance.period.reopen'))

  const lockingSrc = read('src/modules/accounting/period-close/ControlPages.tsx')
  check('Locking page closeAccountingPeriod', lockingSrc.includes('closeAccountingPeriod'))
  check('Locking page readiness blockers', lockingSrc.includes('hardBlockEnabled'))
  check('Locking page getPeriodCloseReadiness', lockingSrc.includes('getPeriodCloseReadiness'))

  const checklistSrc = read('src/modules/accounting/period-close/ChecklistAndReconPages.tsx')
  check('Checklist uses isApiMode', checklistSrc.includes('isApiMode'))
  check('Checklist Ack actions', checklistSrc.includes("onAck(t.id, 'ACK')"))
  check('Checklist saveCloseChecklistAcks', checklistSrc.includes('saveCloseChecklistAcks'))

  const featuresSrc = read('src/modules/accounting/settings/FeaturesPage.tsx')
  check('Features page periodCloseHardBlock', featuresSrc.includes('periodCloseHardBlock'))

  const statusDoc = read('../docs/accounting/PERIOD_CLOSE_STATUS.md')
  check('Status doc Phase 1 shipped', statusDoc.includes('Phase 1'))
  check('Status doc hardening / Phase 2', statusDoc.includes('close-readiness') || statusDoc.includes('Hardening'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
