import type { Request } from 'express'
import { prisma } from '../../../../../config/database.js'
import { executeMatch } from '../../bank-reconciliation/bank-reconciliation-match.service.js'
import type { ReconciliationContext } from '../../bank-reconciliation/bank-reconciliation.types.js'
import { auditFromRequest } from '../../../../../services/audit.service.js'
import * as repo from '../treasury-adjustment.repository.js'
import { TreasuryAdjustmentStatementMatchFailedError } from '../treasury-adjustment.errors.js'
import { serializeTreasuryAdjustment } from '../treasury-adjustment-read.service.js'
import type { PostTreasuryAdjustmentInput } from '../treasury-adjustment.schemas.js'
import { postTreasuryAdjustment } from './treasury-adjustment-posting.service.js'
import { reverseTreasuryAdjustment } from './treasury-adjustment-reverse.service.js'

/**
 * Posts a treasury adjustment and, when it was created from a bank statement line, atomically
 * creates the bank-reconciliation match for the newly-posted bank leg in the same call. If the
 * match fails (e.g. no reconciliation session yet, amount mismatch), the posting is compensated
 * with an immediate reversal so the adjustment never sits POSTED-but-unmatched.
 */
export async function postTreasuryAdjustmentWithStatementMatch(req: Request, tenantId: string, adjustmentId: string, body: PostTreasuryAdjustmentInput) {
  const result = await postTreasuryAdjustment(req, tenantId, adjustmentId, body)
  if (!result || result.idempotentReplay || !result.posting) return result

  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
  if (!adjustment.bankStatementLineId || adjustment.reconciliationMatchId) return result

  const userId = req.context?.userId
  const audit = auditFromRequest(req)
  const context: ReconciliationContext = { tenantId, userId: userId ?? '', ipAddress: audit.ipAddress ?? null, userAgent: audit.userAgent ?? null }

  try {
    const statementLine = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: adjustment.bankStatementLineId, tenantId } })
    const bankLegEntry = await prisma.generalLedgerEntry.findFirstOrThrow({
      where: { voucherId: adjustment.voucherId!, tenantId, accountId: adjustment.glAccountId },
    })

    const match = await executeMatch(
      tenantId,
      {
        statementId: statementLine.bankStatementId,
        statementAllocations: [{ bankStatementLineId: statementLine.id, amount: adjustment.bankAmount.toString() }],
        ledgerAllocations: [{ generalLedgerEntryId: bankLegEntry.id, amount: adjustment.bankAmount.toString() }],
        idempotencyKey: `TADJ_MATCH:${adjustmentId}`,
        note: `Auto-matched from treasury adjustment ${adjustment.adjustmentNumber ?? adjustment.draftReference}`,
      },
      context,
    )

    await prisma.treasuryAdjustment.update({ where: { id: adjustmentId, tenantId }, data: { reconciliationMatchId: match.id } })
    const refreshed = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
    return { adjustment: await serializeTreasuryAdjustment(req, refreshed), posting: result.posting, idempotentReplay: false, match }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Bank reconciliation match failed'
    try {
      await reverseTreasuryAdjustment(req, tenantId, adjustmentId, {
        expectedUpdatedAt: adjustment.updatedAt.toISOString(),
        reversalDate: adjustment.adjustmentDate.toISOString().slice(0, 10),
        reason: `Auto-reversed: statement match failed (${reason})`.slice(0, 500),
        idempotencyKey: `TADJ_MATCH_ROLLBACK:${adjustmentId}`,
      })
    } catch {
      // Best-effort compensation — the original match error is surfaced regardless.
    }
    throw new TreasuryAdjustmentStatementMatchFailedError(reason)
  }
}
