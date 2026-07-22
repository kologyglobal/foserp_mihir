import type { BankStatementLineDirection } from '@prisma/client'
import { post } from '../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingResult } from '../../posting/posting.types.js'
import { BankReconciliationClearingMappingNotFoundError } from './bank-reconciliation.errors.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { getTreasuryAccount } from '../accounts/treasury-account.repository.js'

export function buildClearingSettlementEventKey(matchId: string): string {
  return `BANK_RECON_CLEARING_SETTLEMENT:${matchId}:V1`
}

export interface ClearingSettlementInput {
  matchId: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  treasuryAccountId: string
  clearingGlAccountId: string
  /** Direction of the STATEMENT line driving this settlement (rule #2). */
  statementLineDirection: BankStatementLineDirection
  amount: string
  currencyCode: string
  documentDate: string
  postingDate: string
  narration: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Rule #2 — Clearing CREDIT stmt (receipt clearing DEBIT) settles as Dr Bank / Cr Clearing;
 * DEBIT stmt (payment clearing CREDIT) settles as Dr Clearing / Cr Bank.
 */
export async function postClearingSettlement(input: ClearingSettlementInput): Promise<PostingResult> {
  const treasuryAccount = await getTreasuryAccount(input.tenantId, input.treasuryAccountId)
  const bankGlAccountId = treasuryAccount.glAccountId

  const bankIsDebit = input.statementLineDirection === 'CREDIT'
  const request: PostingRequest = {
    legalEntityId: input.legalEntityId,
    eventKey: buildClearingSettlementEventKey(input.matchId),
    eventType: 'BANK_RECONCILIATION_CLEARING_SETTLED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: input.documentDate,
    postingDate: input.postingDate,
    branchId: input.branchId,
    referenceNumber: null,
    narration: input.narration.slice(0, 500),
    currencyCode: input.currencyCode,
    exchangeRate: '1',
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'BANK_RECONCILIATION_MATCH',
    sourceDocumentId: input.matchId,
    lines: [
      {
        lineNumber: 1,
        accountId: bankGlAccountId,
        debitAmount: bankIsDebit ? input.amount : '0',
        creditAmount: bankIsDebit ? '0' : input.amount,
        currencyCode: input.currencyCode,
        lineNarration: `Bank reconciliation clearing settlement — ${input.narration}`.slice(0, 500),
      },
      {
        lineNumber: 2,
        accountId: input.clearingGlAccountId,
        debitAmount: bankIsDebit ? '0' : input.amount,
        creditAmount: bankIsDebit ? input.amount : '0',
        currencyCode: input.currencyCode,
        lineNarration: `Bank reconciliation clearing settlement — ${input.narration}`.slice(0, 500),
      },
    ],
  }

  const context: PostingContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }

  return post(request, context)
}

/** Resolve the (unique) clearing GL account for a treasury account, or throw if none/ambiguous is not resolvable. */
export async function resolveClearingGlAccountId(tenantId: string, treasuryAccountId: string, glAccountId: string): Promise<string> {
  const ids = await readRepo.findClearingGlAccountIds(tenantId, treasuryAccountId)
  if (!ids.includes(glAccountId)) {
    throw new BankReconciliationClearingMappingNotFoundError(
      'The selected ledger entry is not on a clearing GL account mapped to this treasury account',
    )
  }
  return glAccountId
}
