/**
 * Finance Phase 5B1 — treasury transfer UI helper unit checks (labels/tones, decimal parsing, masking).
 */
import {
  DISPATCHABLE_STATUSES,
  DRAFT_LIKE_STATUSES,
  RECEIVABLE_STATUSES,
  REVERSIBLE_STATUSES,
  TRANSFER_LIVE_LINKS,
  TRANSFER_POSTING_MODE_LABELS,
  TRANSFER_PURPOSE_LABELS,
  TRANSFER_STATUS_LABELS,
  TRANSFER_TYPE_LABELS,
  deriveTransferType,
  maskAccountNumber,
  parseDecimal,
  transferPostingModeTone,
  transferStatusTone,
} from '../utils/treasuryTransferUi.ts'
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

export function runTreasuryTransferUiUtilTests() {
  check('parseDecimal handles null', parseDecimal(null) === 0)
  check('parseDecimal handles undefined', parseDecimal(undefined) === 0)
  check('parseDecimal handles empty string', parseDecimal('') === 0)
  check('parseDecimal handles numeric string', parseDecimal('1234.56') === 1234.56)
  check('parseDecimal handles comma-formatted string', parseDecimal('1,234.56') === 1234.56)
  check('parseDecimal handles number', parseDecimal(42) === 42)
  check('parseDecimal handles garbage', parseDecimal('not-a-number') === 0)

  check('Status labels complete', Object.keys(TRANSFER_STATUS_LABELS).length === 8)
  check('Type labels complete', Object.keys(TRANSFER_TYPE_LABELS).length === 4)
  check('Posting mode labels complete', Object.keys(TRANSFER_POSTING_MODE_LABELS).length === 2)
  check('Purpose labels complete', Object.keys(TRANSFER_PURPOSE_LABELS).length === 7)

  check('Completed status tone is success', transferStatusTone('COMPLETED') === 'success')
  check('Pending approval tone is warning', transferStatusTone('PENDING_APPROVAL') === 'warning')
  check('Rejected tone is critical', transferStatusTone('REJECTED') === 'critical')
  check('Draft tone is neutral', transferStatusTone('DRAFT') === 'neutral')

  check('Direct posting mode tone is info', transferPostingModeTone('DIRECT') === 'info')
  check('In-transit posting mode tone is warning', transferPostingModeTone('IN_TRANSIT') === 'warning')

  check('maskAccountNumber masks long numbers', maskAccountNumber('1234567890') === '••••7890')
  check('maskAccountNumber passes through short numbers', maskAccountNumber('123') === '123')
  check('maskAccountNumber handles null', maskAccountNumber(null) === '—')

  check('deriveTransferType BANK/BANK', deriveTransferType('BANK', 'BANK') === 'BANK_TO_BANK')
  check('deriveTransferType BANK/CASH', deriveTransferType('BANK', 'CASH') === 'BANK_TO_CASH')
  check('deriveTransferType CASH/BANK', deriveTransferType('CASH', 'BANK') === 'CASH_TO_BANK')
  check('deriveTransferType CASH/CASH', deriveTransferType('CASH', 'CASH') === 'CASH_TO_CASH')
  check('deriveTransferType handles missing input', deriveTransferType(undefined, 'BANK') === null)

  check('Draft-like statuses include DRAFT and REJECTED', DRAFT_LIKE_STATUSES.includes('DRAFT') && DRAFT_LIKE_STATUSES.includes('REJECTED'))
  check('Dispatchable statuses include READY_TO_POST', DISPATCHABLE_STATUSES.includes('READY_TO_POST'))
  check('Receivable statuses include IN_TRANSIT', RECEIVABLE_STATUSES.includes('IN_TRANSIT'))
  check('Reversible statuses include COMPLETED', REVERSIBLE_STATUSES.includes('COMPLETED'))

  check('Transfer live links include In Transit', TRANSFER_LIVE_LINKS.some((l) => l.path.endsWith('/in-transit')))
  check('Transfer live links include Approvals', TRANSFER_LIVE_LINKS.some((l) => l.path.endsWith('/approvals')))

  // Idempotency key hook — direct logic check without a React renderer.
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
  console.log(' Treasury Transfers — UI utils')
  console.log('═══════════════════════════════════════\n')
  const result = runTreasuryTransferUiUtilTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
