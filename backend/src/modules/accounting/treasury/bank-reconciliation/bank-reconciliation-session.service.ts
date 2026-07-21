import type { BankReconciliationSession } from '@prisma/client'
import { getTreasuryAccount } from '../accounts/treasury-account.repository.js'
import { BankStatementNotReadyForReconciliationError } from './bank-reconciliation.errors.js'
import * as repo from './bank-reconciliation.repository.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'

/** Statement statuses treated as "reviewed and ready to reconcile" (READY_TO_RECONCILE / PARTIALLY_RECONCILED
 * already imply VALIDATED happened earlier). */
const RECONCILABLE_STATEMENT_STATUSES = new Set(['VALIDATED', 'READY_TO_RECONCILE', 'PARTIALLY_RECONCILED'])

export async function getOrCreateSession(
  tenantId: string,
  userId: string,
  statementId: string,
): Promise<BankReconciliationSession> {
  const existing = await repo.findSessionByStatementId(tenantId, statementId)
  if (existing) return existing

  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  if (!RECONCILABLE_STATEMENT_STATUSES.has(statement.status)) {
    throw new BankStatementNotReadyForReconciliationError(
      `Statement must be VALIDATED before reconciliation can begin (current status: ${statement.status})`,
    )
  }
  const treasuryAccount = await getTreasuryAccount(tenantId, statement.treasuryAccountId)

  return repo.createSession({
    tenantId,
    legalEntityId: statement.legalEntityId,
    branchId: treasuryAccount.branchId ?? null,
    treasuryAccountId: statement.treasuryAccountId,
    bankStatementId: statement.id,
    statementStartDate: statement.periodStartDate,
    statementEndDate: statement.periodEndDate,
    statementOpeningBalance: formatForPersistence(statement.openingBalance),
    statementClosingBalance: formatForPersistence(statement.closingBalance),
    totalStatementDebit: formatForPersistence(statement.totalDebitAmount),
    totalStatementCredit: formatForPersistence(statement.totalCreditAmount),
    createdById: userId,
  })
}

export async function getSessionForStatementOrThrow(
  tenantId: string,
  statementId: string,
): Promise<BankReconciliationSession> {
  return repo.getSessionByStatementIdOrThrow(tenantId, statementId)
}

export function assertStatementReconcilable(statementStatus: string): void {
  if (!RECONCILABLE_STATEMENT_STATUSES.has(statementStatus)) {
    throw new BankStatementNotReadyForReconciliationError(
      `Statement must be VALIDATED before reconciliation can begin (current status: ${statementStatus})`,
    )
  }
}
