import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { getEffectiveMatchingSettings } from './bank-reconciliation-settings.helper.js'
import * as repo from './bank-reconciliation.repository.js'
import {
  BankReconciliationAlreadyFinalizedError,
  BankReconciliationFinalizeIncompleteError,
  BankReconciliationFinalizeToleranceExceededError,
  BankReconciliationNotFinalizedError,
} from './bank-reconciliation.errors.js'
import type { ReconciliationContext, SessionDto } from './bank-reconciliation.types.js'

function toSessionDto(session: Awaited<ReturnType<typeof repo.getSessionOrThrow>>): SessionDto {
  return {
    id: session.id,
    tenantId: session.tenantId,
    legalEntityId: session.legalEntityId,
    branchId: session.branchId,
    treasuryAccountId: session.treasuryAccountId,
    bankStatementId: session.bankStatementId,
    status: session.status,
    statementStartDate: session.statementStartDate.toISOString().slice(0, 10),
    statementEndDate: session.statementEndDate.toISOString().slice(0, 10),
    statementOpeningBalance: session.statementOpeningBalance != null ? formatForPersistence(session.statementOpeningBalance) : null,
    statementClosingBalance: session.statementClosingBalance != null ? formatForPersistence(session.statementClosingBalance) : null,
    totalStatementDebit: formatForPersistence(session.totalStatementDebit),
    totalStatementCredit: formatForPersistence(session.totalStatementCredit),
    matchedStatementAmount: formatForPersistence(session.matchedStatementAmount),
    unmatchedStatementAmount: formatForPersistence(session.unmatchedStatementAmount),
    matchedBookAmount: formatForPersistence(session.matchedBookAmount),
    unmatchedBookAmount: formatForPersistence(session.unmatchedBookAmount),
    adjustedStatementBalance: session.adjustedStatementBalance != null ? formatForPersistence(session.adjustedStatementBalance) : null,
    adjustedBookBalance: session.adjustedBookBalance != null ? formatForPersistence(session.adjustedBookBalance) : null,
    reconciliationDifference: session.reconciliationDifference != null ? formatForPersistence(session.reconciliationDifference) : null,
    finalizedAt: session.finalizedAt ? session.finalizedAt.toISOString() : null,
    finalizedById: session.finalizedById,
    reopenedAt: session.reopenedAt ? session.reopenedAt.toISOString() : null,
    reopenedById: session.reopenedById,
    reopenReason: session.reopenReason,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

export async function finalizeSession(
  tenantId: string,
  statementId: string,
  context: ReconciliationContext,
  force = false,
): Promise<SessionDto> {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)

  if (session.status === 'FINALIZED') return toSessionDto(session)
  if (session.status === 'CANCELLED') throw new BankReconciliationAlreadyFinalizedError('Session is cancelled')

  const settings = await getEffectiveMatchingSettings(tenantId, session.treasuryAccountId)
  const counts = await readRepo.countLinesByMatchStatus(tenantId, statementId)
  const openExceptions = await repo.countOpenExceptionsForSession(tenantId, session.id)

  const unresolvedLines = (counts.UNMATCHED ?? 0) + (counts.PARTIALLY_MATCHED ?? 0)
  if (settings.requireFullMatchToFinalize && unresolvedLines > 0 && !force) {
    if (!settings.allowFinalizeWithExceptions || openExceptions < unresolvedLines) {
      throw new BankReconciliationFinalizeIncompleteError(
        `${unresolvedLines} statement line(s) are still unmatched or partially matched`,
      )
    }
  }

  const reconciliationDifference = toDecimal(session.unmatchedStatementAmount).sub(session.unmatchedBookAmount).abs()
  if (reconciliationDifference.gt(settings.finalizationDifferenceTolerance) && !force) {
    throw new BankReconciliationFinalizeToleranceExceededError(
      `Reconciliation difference ${reconciliationDifference.toFixed(4)} exceeds tolerance ${settings.finalizationDifferenceTolerance}`,
    )
  }

  const finalized = await prisma.$transaction(async (tx) => {
    await repo.lockSessionForUpdate(tx, tenantId, session.id)
    const updatedSession = await tx.bankReconciliationSession.update({
      where: { id: session.id },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedById: context.userId,
        reconciliationDifference: formatForPersistence(reconciliationDifference),
        adjustedStatementBalance: session.statementClosingBalance,
        adjustedBookBalance: session.statementClosingBalance,
      },
    })
    await tx.bankStatement.update({
      where: { id: statementId },
      data: { status: unresolvedLines === 0 ? 'RECONCILED' : 'PARTIALLY_RECONCILED', reconciledAt: new Date(), reconciledBy: context.userId },
    })
    return updatedSession
  })

  await auditBankReconciliation(context, 'bank_reconciliation_session', session.id, 'BANK_RECON_FINALIZED', {
    statementId,
    unresolvedLines,
    reconciliationDifference: reconciliationDifference.toFixed(4),
  })

  return toSessionDto(finalized)
}

export async function reopenSession(
  tenantId: string,
  statementId: string,
  reason: string,
  context: ReconciliationContext,
): Promise<SessionDto> {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)
  if (session.status !== 'FINALIZED') {
    throw new BankReconciliationNotFinalizedError()
  }

  const reopened = await prisma.$transaction(async (tx) => {
    await repo.lockSessionForUpdate(tx, tenantId, session.id)
    const updated = await tx.bankReconciliationSession.update({
      where: { id: session.id },
      data: { status: 'REOPENED', reopenedAt: new Date(), reopenedById: context.userId, reopenReason: reason },
    })
    await tx.bankStatement.update({
      where: { id: statementId },
      data: { status: 'READY_TO_RECONCILE' },
    })
    return updated
  })

  await auditBankReconciliation(context, 'bank_reconciliation_session', session.id, 'BANK_RECON_REOPENED', { statementId, reason })

  return toSessionDto(reopened)
}

export { toSessionDto }
