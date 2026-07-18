import { compare, toDecimal } from '../../shared/finance-decimal.js'
import {
  ReceivableOpenItemAmountInvariantError,
  ReceivableOpenItemNegativeOriginalError,
} from './customer-receipt.errors.js'

/**
 * Unified open-item amount invariants (Phase 3B1).
 * Amounts are stored positive; side distinguishes debit vs credit subledger rows.
 * openAmount is the unsettled balance (API may alias to outstandingAmount for debits).
 */
export interface OpenItemAmountFields {
  side: 'DEBIT' | 'CREDIT'
  originalAmount: string
  openAmount: string
  allocatedAmount?: string
  adjustedAmount?: string
  writtenOffAmount?: string
}

export function assertNonNegativeOriginal(originalAmount: string): void {
  if (compare(originalAmount, '0') < 0) {
    throw new ReceivableOpenItemNegativeOriginalError()
  }
}

export function assertOpenAmountInvariant(fields: OpenItemAmountFields): void {
  assertNonNegativeOriginal(fields.originalAmount)

  const open = toDecimal(fields.openAmount)
  const original = toDecimal(fields.originalAmount)
  const allocated = toDecimal(fields.allocatedAmount ?? '0')
  const adjusted = toDecimal(fields.adjustedAmount ?? '0')
  const writtenOff = toDecimal(fields.writtenOffAmount ?? '0')

  if (open.lt(0)) {
    throw new ReceivableOpenItemAmountInvariantError('openAmount must be zero or positive')
  }

  if (open.gt(original)) {
    throw new ReceivableOpenItemAmountInvariantError('openAmount cannot exceed originalAmount')
  }

  const settled = allocated.add(adjusted).add(writtenOff)
  const expectedOpen = original.sub(settled)
  if (!open.eq(expectedOpen)) {
    throw new ReceivableOpenItemAmountInvariantError(
      'openAmount must equal originalAmount minus allocated, adjusted, and written-off amounts',
    )
  }
}

export function assertDebitOpenItem(side: string): void {
  if (side !== 'DEBIT') {
    throw new ReceivableOpenItemAmountInvariantError('Expected a debit (invoice) open item')
  }
}

export function assertCreditOpenItem(side: string): void {
  if (side !== 'CREDIT') {
    throw new ReceivableOpenItemAmountInvariantError('Expected a credit (receipt) open item')
  }
}

/** Reporting filter helper — only debit rows belong in invoice outstanding. */
export const DEBIT_OPEN_ITEM_SIDE_FILTER = { side: 'DEBIT' as const }
