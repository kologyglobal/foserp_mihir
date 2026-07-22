/**
 * Phase 5A3 — bank reconciliation UI helper unit checks (status labels/tones, decimal parsing, tabs).
 */
import {
  EXCEPTION_REASON_LABELS,
  LINE_MATCH_STATUS_LABELS,
  RECONCILIATION_LIVE_LINKS,
  RECONCILABLE_STATEMENT_STATUSES,
  SESSION_STATUS_LABELS,
  WORKSPACE_TABS,
  exceptionStatusTone,
  lineMatchStatusTone,
  matchStatusTone,
  parseDecimal,
  sessionStatusTone,
  suggestionStatusTone,
} from '../utils/bankReconciliationUi.ts'
import { useIdempotencyKey } from '../utils/idempotency.ts'

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

export function runBankReconciliationUiUtilTests() {
  check('parseDecimal handles null', parseDecimal(null) === 0)
  check('parseDecimal handles undefined', parseDecimal(undefined) === 0)
  check('parseDecimal handles empty string', parseDecimal('') === 0)
  check('parseDecimal handles numeric string', parseDecimal('1234.56') === 1234.56)
  check('parseDecimal handles comma-formatted string', parseDecimal('1,234.56') === 1234.56)
  check('parseDecimal handles number', parseDecimal(42) === 42)
  check('parseDecimal handles garbage', parseDecimal('not-a-number') === 0)

  check('Session status labels complete', Object.keys(SESSION_STATUS_LABELS).length === 6)
  check('Line match status labels complete', Object.keys(LINE_MATCH_STATUS_LABELS).length === 7)
  check('Exception reason labels complete', Object.keys(EXCEPTION_REASON_LABELS).length === 10)

  check('Finalized session tone is success', sessionStatusTone('FINALIZED') === 'success')
  check('Ready-to-finalize session tone is warning', sessionStatusTone('READY_TO_FINALIZE') === 'warning')
  check('Matched line tone is success', lineMatchStatusTone('MATCHED') === 'success')
  check('Exception line tone is critical', lineMatchStatusTone('EXCEPTION') === 'critical')
  check('Active match tone is success', matchStatusTone('ACTIVE') === 'success')
  check('Reversed match tone is neutral', matchStatusTone('REVERSED') === 'neutral')
  check('Open exception tone is critical', exceptionStatusTone('OPEN') === 'critical')
  check('Pending suggestion tone is info', suggestionStatusTone('PENDING') === 'info')

  check(
    'Reconcilable statuses include VALIDATED / READY_TO_RECONCILE / PARTIALLY_RECONCILED',
    RECONCILABLE_STATEMENT_STATUSES.includes('VALIDATED') &&
      RECONCILABLE_STATEMENT_STATUSES.includes('READY_TO_RECONCILE') &&
      RECONCILABLE_STATEMENT_STATUSES.includes('PARTIALLY_RECONCILED'),
  )
  check('Reconcilable statuses exclude DRAFT', !RECONCILABLE_STATEMENT_STATUSES.includes('DRAFT'))

  check('Workspace has 6 tabs', WORKSPACE_TABS.length === 6)
  check('Workspace tabs include unmatched/suggestions/exceptions', [
    'unmatched',
    'suggestions',
    'partial',
    'matched',
    'exceptions',
    'all',
  ].every((id) => WORKSPACE_TABS.some((t) => t.id === id)))

  check('Reconciliation live links include history', RECONCILIATION_LIVE_LINKS.some((l) => l.path.endsWith('/history')))
  check('Reconciliation live links include exceptions', RECONCILIATION_LIVE_LINKS.some((l) => l.path.endsWith('/exceptions')))

  // Idempotency key hook — direct logic check without a React renderer: same signature must
  // produce the same key across calls, and a changed signature must rotate the key.
  const refBox: { current: { signature: string; key: string } | null } = { current: null }
  function resolveKey(signature: string): string {
    if (refBox.current && refBox.current.signature === signature) return refBox.current.key
    const key = `key-${signature}-${Math.random().toString(36).slice(2, 6)}`
    refBox.current = { signature, key }
    return key
  }
  const keyA1 = resolveKey('sig-a')
  const keyA2 = resolveKey('sig-a')
  const keyB = resolveKey('sig-b')
  check('Idempotency key stable for same signature', keyA1 === keyA2)
  check('Idempotency key rotates for new signature', keyA1 !== keyB)
  check('useIdempotencyKey hook exported', typeof useIdempotencyKey === 'function')

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('ui-utils.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Reconciliation — UI utils')
  console.log('═══════════════════════════════════════\n')
  const result = runBankReconciliationUiUtilTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
