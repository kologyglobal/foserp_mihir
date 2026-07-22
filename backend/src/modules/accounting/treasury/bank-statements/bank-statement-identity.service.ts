import { createHash } from 'node:crypto'

/**
 * Deterministic identity keys for bank statement de-duplication across re-imports.
 */

export interface StatementUniquenessKeyInput {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  statementReference: string
  periodStartDate: Date
  periodEndDate: Date
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** `BankStatement.statementUniquenessKey` — dedupe key across re-imports of the same period/reference. */
export function buildStatementUniquenessKey(input: StatementUniquenessKeyInput): string {
  const raw = [
    input.tenantId,
    input.legalEntityId,
    input.treasuryAccountId,
    input.statementReference.trim().toUpperCase(),
    isoDate(input.periodStartDate),
    isoDate(input.periodEndDate),
  ].join('|')
  return createHash('sha256').update(raw).digest('hex')
}

export interface StatementLineHashInput {
  /** @deprecated Prefer treasuryAccountId for cross-statement duplicates (Phase 5A2). */
  bankStatementId?: string
  treasuryAccountId: string
  transactionDate: Date
  direction: 'CREDIT' | 'DEBIT'
  amount: number | string
  referenceNumber?: string | null
  description?: string | null
  bankTransactionId?: string | null
  externalTransactionId?: string | null
}

/**
 * Content hash for exact duplicate detection across statements on the same treasury account.
 */
export function buildStatementLineHash(input: StatementLineHashInput): string {
  const amount =
    typeof input.amount === 'number' ? input.amount.toFixed(2) : String(input.amount).trim()
  const raw = [
    input.treasuryAccountId,
    isoDate(input.transactionDate),
    input.direction,
    amount,
    (input.referenceNumber ?? '').trim().toUpperCase(),
    (input.description ?? '').trim().toUpperCase(),
    (input.bankTransactionId ?? '').trim().toUpperCase(),
    (input.externalTransactionId ?? '').trim().toUpperCase(),
  ].join('|')
  return createHash('sha256').update(raw).digest('hex')
}
