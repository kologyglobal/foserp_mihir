import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { post } from '../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine, PostingResult } from '../../posting/posting.types.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import * as repo from './bank-reconciliation.repository.js'
import { BankReconciliationMatchAlreadyReversedError } from './bank-reconciliation.errors.js'
import { matchRowToDto } from './bank-reconciliation-match.service.js'
import type { BankReconciliationMatchDto, ReconciliationContext } from './bank-reconciliation.types.js'

function buildClearingReversalEventKey(matchId: string): string {
  return `BANK_RECON_CLEARING_REVERSAL:${matchId}:V1`
}

async function postExactReversal(
  tenantId: string,
  matchId: string,
  voucherId: string,
  reason: string,
  context: ReconciliationContext,
): Promise<PostingResult> {
  const voucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: voucherId, tenantId } })
  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId, tenantId }, orderBy: { lineNumber: 'asc' } })

  const reversalLines: PostingRequestLine[] = lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    debitAmount: formatForPersistence(line.creditAmount),
    creditAmount: formatForPersistence(line.debitAmount),
    currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate.toString(),
    lineNarration: `Reversal: ${line.lineNarration ?? ''}`.slice(0, 500),
  }))

  const request: PostingRequest = {
    legalEntityId: voucher.legalEntityId,
    eventKey: buildClearingReversalEventKey(matchId),
    eventType: 'BANK_RECONCILIATION_CLEARING_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: voucher.documentDate.toISOString().slice(0, 10),
    postingDate: voucher.postingDate.toISOString().slice(0, 10),
    branchId: voucher.branchId,
    narration: `Reversal of bank reconciliation clearing settlement ${voucher.voucherNumber ?? voucher.id}: ${reason}`.slice(0, 500),
    currencyCode: voucher.currencyCode,
    exchangeRate: voucher.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'BANK_RECONCILIATION_MATCH',
    sourceDocumentId: matchId,
    lines: reversalLines,
  }
  const postingContext: PostingContext = {
    tenantId,
    userId: context.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }
  return post(request, postingContext)
}

/**
 * DIRECT / JOURNAL_CREATED_FROM_STATEMENT matches: reverse the subledger allocations only
 * (no voucher ever existed). CLEARING matches: additionally post an exact reversal voucher
 * before reversing the allocations. Idempotent by current match state (REVERSED ⇒ no-op replay).
 */
export async function unmatch(
  tenantId: string,
  matchId: string,
  reason: string,
  context: ReconciliationContext,
): Promise<BankReconciliationMatchDto> {
  const match = await repo.getMatchByIdOrThrow(tenantId, matchId)
  if (match.matchStatus === 'REVERSED') {
    return matchRowToDto(match)
  }

  let reversalVoucherId: string | null = null
  let reversalPostingEventId: string | null = null
  if (match.postingMode === 'CLEARING_SETTLEMENT' && match.accountingVoucherId) {
    const posting = await postExactReversal(tenantId, matchId, match.accountingVoucherId, reason, context)
    reversalVoucherId = posting.voucherId
    reversalPostingEventId = posting.postingEventId
  }

  await prisma.$transaction(async (tx) => {
    await repo.lockSessionForUpdate(tx, tenantId, match.reconciliationSessionId)
    await repo.lockStatementLinesForUpdate(tx, tenantId, match.statementAllocations.map((a) => a.bankStatementLineId))
    await repo.lockGeneralLedgerEntriesForUpdate(tx, tenantId, match.ledgerAllocations.map((a) => a.generalLedgerEntryId))

    await repo.markMatchReversedTx(tx, tenantId, matchId, {
      reversalReason: reason,
      reversedById: context.userId,
      reversalVoucherId,
      reversalPostingEventId,
    })

    for (const alloc of match.statementAllocations) {
      await repo.applyStatementLineAllocationDelta(tx, tenantId, alloc.bankStatementLineId, toDecimal(alloc.matchedAmount).neg())
    }
    for (const alloc of match.ledgerAllocations) {
      await repo.applyLedgerPositionDelta(tx, tenantId, alloc.generalLedgerEntryId, toDecimal(alloc.matchedAmount).neg())
    }
    await repo.adjustSessionTotals(tx, tenantId, match.reconciliationSessionId, {
      matchedStatementAmount: toDecimal(match.matchedAmount).neg(),
      matchedBookAmount: toDecimal(match.matchedAmount).neg(),
    })
  })

  await auditBankReconciliation(context, 'bank_reconciliation_match', matchId, 'BANK_RECON_MATCH_UNMATCHED', {
    reason,
    reversalVoucherId,
    matchSource: match.matchSource,
    matchedAmount: formatForPersistence(match.matchedAmount),
  })

  const updated = await repo.getMatchByIdOrThrow(tenantId, matchId)
  return matchRowToDto(updated)
}

export function assertNotAlreadyReversed(matchStatus: string): void {
  if (matchStatus === 'REVERSED') throw new BankReconciliationMatchAlreadyReversedError()
}
