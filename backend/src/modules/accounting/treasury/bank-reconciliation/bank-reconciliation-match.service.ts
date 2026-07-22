import { randomUUID } from 'node:crypto'
import type { BankReconciliationMatchMethod, BankReconciliationMatchSource, GeneralLedgerEntry } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { hashPayload } from '../../shared/payload-hash.js'
import { getTreasuryAccount } from '../accounts/treasury-account.repository.js'
import { postClearingSettlement } from './bank-reconciliation-clearing-posting.service.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import { reserveBankReconciliationMatchReference } from './bank-reconciliation-number.service.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { getEffectiveMatchingSettings } from './bank-reconciliation-settings.helper.js'
import * as repo from './bank-reconciliation.repository.js'
import {
  BankReconciliationAlreadyAllocatedError,
  BankReconciliationAmountMismatchError,
  BankReconciliationConcurrentChangeError,
  BankReconciliationCurrencyMismatchError,
  BankReconciliationDirectionMismatchError,
  BankReconciliationGroupSizeExceededError,
  BankReconciliationGroupedNotAllowedError,
  BankReconciliationIdempotencyPayloadMismatchError,
  BankReconciliationMixedSourceError,
  BankReconciliationPartialNotAllowedError,
} from './bank-reconciliation.errors.js'
import type {
  BankReconciliationMatchDto,
  CreateMatchInput,
  LedgerAllocationInput,
  MatchPreviewResultDto,
  PreviewMatchInput,
  ReconciliationContext,
  SettlementLinePreviewDto,
  StatementAllocationInput,
} from './bank-reconciliation.types.js'

export interface MatchPlan {
  statementId: string
  legalEntityId: string
  treasuryAccountId: string
  bankGlAccountId: string
  currencyCode: string
  matchSource: BankReconciliationMatchSource
  matchMethod: BankReconciliationMatchMethod
  matchedAmount: string
  statementAllocations: Array<{ bankStatementLineId: string; amount: string; lineDirection: 'CREDIT' | 'DEBIT' }>
  ledgerAllocations: Array<{ generalLedgerEntryId: string; amount: string; accountId: string; entry: GeneralLedgerEntry }>
  clearingGlAccountId: string | null
  settlementPreview: SettlementLinePreviewDto[] | null
  warnings: string[]
  note: string | null
}

function buildPayloadHash(statementId: string, statementAllocations: StatementAllocationInput[], ledgerAllocations: LedgerAllocationInput[]): string {
  return hashPayload({
    statementId,
    statementAllocations: [...statementAllocations].sort((a, b) => (a.bankStatementLineId < b.bankStatementLineId ? -1 : 1)),
    ledgerAllocations: [...ledgerAllocations].sort((a, b) => (a.generalLedgerEntryId < b.generalLedgerEntryId ? -1 : 1)),
  })
}

/** Validates and resolves a proposed match without persisting anything. Shared by preview and create. */
export async function buildMatchPlan(tenantId: string, input: PreviewMatchInput): Promise<MatchPlan> {
  const warnings: string[] = []
  const statement = await readRepo.getStatementOrThrow(tenantId, input.statementId)
  const treasuryAccount = await getTreasuryAccount(tenantId, statement.treasuryAccountId)
  const settings = await getEffectiveMatchingSettings(tenantId, statement.treasuryAccountId)

  const lineIds = input.statementAllocations.map((a) => a.bankStatementLineId)
  const entryIds = input.ledgerAllocations.map((a) => a.generalLedgerEntryId)
  if (new Set(lineIds).size !== lineIds.length || new Set(entryIds).size !== entryIds.length) {
    throw new BankReconciliationAmountMismatchError('Duplicate line/entry ids in allocation request')
  }

  const lines = await readRepo.getStatementLinesByIds(tenantId, input.statementId, lineIds)
  const entries = await readRepo.getGeneralLedgerEntriesByIds(tenantId, entryIds)
  if (entries.length !== entryIds.length) {
    throw new BankReconciliationConcurrentChangeError('One or more ledger entries were not found')
  }

  const directions = new Set(lines.map((l) => l.direction))
  if (directions.size > 1) {
    throw new BankReconciliationDirectionMismatchError('All statement lines in a single match must share the same direction')
  }
  const lineDirection = lines[0].direction
  const requiredSide: 'DEBIT' | 'CREDIT' = lineDirection === 'CREDIT' ? 'DEBIT' : 'CREDIT'

  for (const entry of entries) {
    if (entry.currencyCode !== statement.currencyCode) {
      throw new BankReconciliationCurrencyMismatchError()
    }
    const sideAmount = requiredSide === 'DEBIT' ? entry.debitAmount : entry.creditAmount
    if (toDecimal(sideAmount).lte(0)) {
      throw new BankReconciliationDirectionMismatchError(
        `Statement ${lineDirection} lines require a ${requiredSide} ledger entry (entry ${entry.id} does not qualify)`,
      )
    }
  }

  const clearingGlAccountIds = new Set(await readRepo.findClearingGlAccountIds(tenantId, statement.treasuryAccountId))
  const accountIds = new Set(entries.map((e) => e.accountId))
  let matchSource: BankReconciliationMatchSource
  if ([...accountIds].every((id) => id === treasuryAccount.glAccountId)) {
    matchSource = 'DIRECT_BANK_GL'
  } else if ([...accountIds].every((id) => clearingGlAccountIds.has(id))) {
    if (accountIds.size > 1) {
      throw new BankReconciliationMixedSourceError('All ledger entries in a CLEARING match must be on the same clearing GL account')
    }
    matchSource = 'CLEARING_GL'
  } else {
    throw new BankReconciliationMixedSourceError()
  }

  if (matchSource === 'DIRECT_BANK_GL') {
    const allLinkedJournalIds = new Set(
      (await readRepo.listStatementLines(tenantId, statement.id))
        .map((l) => l.linkedJournalId)
        .filter((id): id is string => Boolean(id)),
    )
    const voucherIds = [...new Set(entries.map((e) => e.voucherId))]
    const vouchers = await prisma.accountingVoucher.findMany({
      where: { id: { in: voucherIds }, tenantId },
      select: { id: true, sourceDocumentType: true, sourceDocumentId: true },
    })
    const fromStatementDraft = vouchers.every(
      (v) => v.sourceDocumentType === 'MANUAL_JOURNAL' && v.sourceDocumentId && allLinkedJournalIds.has(v.sourceDocumentId),
    )
    if (fromStatementDraft && vouchers.length > 0) {
      matchSource = 'JOURNAL_CREATED_FROM_STATEMENT'
    }
  }

  const statementTotal = input.statementAllocations.reduce((acc, a) => acc.add(a.amount), toDecimal(0))
  const ledgerTotal = input.ledgerAllocations.reduce((acc, a) => acc.add(a.amount), toDecimal(0))
  if (!statementTotal.eq(ledgerTotal)) {
    throw new BankReconciliationAmountMismatchError(
      `Statement allocation total (${statementTotal.toFixed(4)}) must equal ledger allocation total (${ledgerTotal.toFixed(4)})`,
    )
  }
  if (statementTotal.lte(0)) {
    throw new BankReconciliationAmountMismatchError('Match amount must be greater than zero')
  }

  const groupSize = Math.max(input.statementAllocations.length, input.ledgerAllocations.length)
  if (groupSize > settings.maximumGroupSize) {
    throw new BankReconciliationGroupSizeExceededError(
      `Match spans ${groupSize} items, exceeding the configured maximum group size of ${settings.maximumGroupSize}`,
    )
  }
  const isGrouped = input.statementAllocations.length > 1 || input.ledgerAllocations.length > 1
  if (isGrouped && !settings.allowManualGroupedMatch) {
    throw new BankReconciliationGroupedNotAllowedError()
  }

  let isPartial = false
  for (const alloc of input.statementAllocations) {
    const line = lines.find((l) => l.id === alloc.bankStatementLineId)!
    const remaining = toDecimal(line.amount).sub(line.matchedAmount)
    if (toDecimal(alloc.amount).gt(remaining)) {
      throw new BankReconciliationAlreadyAllocatedError(`Statement line ${line.id} does not have enough unmatched amount remaining`)
    }
    if (toDecimal(alloc.amount).lt(remaining)) isPartial = true
  }
  const unreconciledMap = new Map<string, ReturnType<typeof toDecimal>>()
  for (const entry of entries) {
    const position = await prisma.bankLedgerReconciliationPosition.findFirst({ where: { tenantId, generalLedgerEntryId: entry.id } })
    const unreconciled = position ? toDecimal(position.unreconciledAmount) : toDecimal(requiredSide === 'DEBIT' ? entry.debitAmount : entry.creditAmount)
    unreconciledMap.set(entry.id, unreconciled)
  }
  for (const alloc of input.ledgerAllocations) {
    const remaining = unreconciledMap.get(alloc.generalLedgerEntryId)!
    if (toDecimal(alloc.amount).gt(remaining)) {
      throw new BankReconciliationAlreadyAllocatedError(`Ledger entry ${alloc.generalLedgerEntryId} does not have enough unreconciled amount remaining`)
    }
    if (toDecimal(alloc.amount).lt(remaining)) isPartial = true
  }
  if (isPartial && !settings.allowManualPartialMatch) {
    throw new BankReconciliationPartialNotAllowedError()
  }

  const matchMethod: BankReconciliationMatchMethod = isPartial ? 'PARTIAL_MANUAL' : isGrouped ? 'GROUPED_MANUAL' : 'MANUAL'
  const matchedAmount = formatForPersistence(statementTotal)

  let settlementPreview: SettlementLinePreviewDto[] | null = null
  let clearingGlAccountId: string | null = null
  if (matchSource === 'CLEARING_GL') {
    clearingGlAccountId = entries[0].accountId
    const bankIsDebit = lineDirection === 'CREDIT'
    settlementPreview = [
      { side: bankIsDebit ? 'DEBIT' : 'CREDIT', accountId: treasuryAccount.glAccountId, accountRole: 'BANK', amount: matchedAmount },
      { side: bankIsDebit ? 'CREDIT' : 'DEBIT', accountId: clearingGlAccountId, accountRole: 'CLEARING', amount: matchedAmount },
    ]
  }

  return {
    statementId: statement.id,
    legalEntityId: statement.legalEntityId,
    treasuryAccountId: statement.treasuryAccountId,
    bankGlAccountId: treasuryAccount.glAccountId,
    currencyCode: statement.currencyCode,
    matchSource,
    matchMethod,
    matchedAmount,
    statementAllocations: input.statementAllocations.map((a) => ({
      bankStatementLineId: a.bankStatementLineId,
      amount: formatForPersistence(a.amount),
      lineDirection: lineDirection as 'CREDIT' | 'DEBIT',
    })),
    ledgerAllocations: input.ledgerAllocations.map((a) => ({
      generalLedgerEntryId: a.generalLedgerEntryId,
      amount: formatForPersistence(a.amount),
      accountId: entries.find((e) => e.id === a.generalLedgerEntryId)!.accountId,
      entry: entries.find((e) => e.id === a.generalLedgerEntryId)!,
    })),
    clearingGlAccountId,
    settlementPreview,
    warnings,
    note: input.note ?? null,
  }
}

export function planToPreviewDto(plan: MatchPlan): MatchPreviewResultDto {
  return {
    matchSource: plan.matchSource,
    matchMethod: plan.matchMethod,
    postingMode: plan.matchSource === 'CLEARING_GL' ? 'CLEARING_SETTLEMENT' : 'NONE',
    matchedAmount: plan.matchedAmount,
    currencyCode: plan.currencyCode,
    statementAllocations: plan.statementAllocations,
    ledgerAllocations: plan.ledgerAllocations.map((a) => ({ generalLedgerEntryId: a.generalLedgerEntryId, amount: a.amount, accountId: a.accountId })),
    settlementPreview: plan.settlementPreview,
    warnings: plan.warnings,
  }
}

function toMatchDto(match: repo.BankReconciliationMatchWithAllocations, idempotentReplay = false): BankReconciliationMatchDto {
  return {
    id: match.id,
    tenantId: match.tenantId,
    legalEntityId: match.legalEntityId,
    reconciliationSessionId: match.reconciliationSessionId,
    treasuryAccountId: match.treasuryAccountId,
    matchReference: match.matchReference,
    matchMethod: match.matchMethod,
    matchSource: match.matchSource,
    matchStatus: match.matchStatus,
    confidenceScore: match.confidenceScore ? formatForPersistence(match.confidenceScore, 2) : null,
    confidenceLevel: match.confidenceLevel,
    reasonCodes: match.reasonCodes,
    accountCurrencyCode: match.accountCurrencyCode,
    matchedAmount: formatForPersistence(match.matchedAmount),
    baseMatchedAmount: formatForPersistence(match.baseMatchedAmount),
    postingMode: match.postingMode,
    accountingVoucherId: match.accountingVoucherId,
    postingEventId: match.postingEventId,
    reversalVoucherId: match.reversalVoucherId,
    reversalPostingEventId: match.reversalPostingEventId,
    note: match.note,
    matchedAt: match.matchedAt.toISOString(),
    matchedById: match.matchedById,
    reversedAt: match.reversedAt ? match.reversedAt.toISOString() : null,
    reversedById: match.reversedById,
    reversalReason: match.reversalReason,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
    statementAllocations: match.statementAllocations.map((a) => ({
      id: a.id,
      bankStatementLineId: a.bankStatementLineId,
      matchedAmount: formatForPersistence(a.matchedAmount),
    })),
    ledgerAllocations: match.ledgerAllocations.map((a) => ({
      id: a.id,
      generalLedgerEntryId: a.generalLedgerEntryId,
      accountingVoucherId: a.accountingVoucherId,
      accountId: a.accountId,
      sourceDocumentType: a.sourceDocumentType,
      sourceDocumentId: a.sourceDocumentId,
      sourceDocumentNumber: a.sourceDocumentNumber,
      matchedAmount: formatForPersistence(a.matchedAmount),
    })),
    idempotentReplay,
  }
}

export interface ExecuteMatchOptions {
  matchMethodOverride?: BankReconciliationMatchMethod
  confidenceScore?: string | null
  confidenceLevel?: string | null
  reasonCodes?: unknown
  skipGroupedGate?: boolean
}

/** Core match-persistence engine shared by manual create-match and the auto-match runner. */
export async function executeMatch(
  tenantId: string,
  input: CreateMatchInput,
  context: ReconciliationContext,
  options: ExecuteMatchOptions = {},
): Promise<BankReconciliationMatchDto> {
  const payloadHash = buildPayloadHash(input.statementId, input.statementAllocations, input.ledgerAllocations)
  const existing = await repo.findMatchByIdempotencyKey(tenantId, input.idempotencyKey)
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new BankReconciliationIdempotencyPayloadMismatchError()
    return toMatchDto(existing, true)
  }

  const plan = await buildMatchPlan(tenantId, input)
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, input.statementId)
  const matchId = randomUUID()

  let accountingVoucherId: string | null = null
  let postingEventId: string | null = null
  if (plan.matchSource === 'CLEARING_GL') {
    const statementLine = (await readRepo.getStatementLinesByIds(tenantId, input.statementId, [plan.statementAllocations[0].bankStatementLineId]))[0]
    const posting = await postClearingSettlement({
      matchId,
      tenantId,
      legalEntityId: plan.legalEntityId,
      branchId: session.branchId,
      treasuryAccountId: plan.treasuryAccountId,
      clearingGlAccountId: plan.clearingGlAccountId!,
      statementLineDirection: plan.statementAllocations[0].lineDirection,
      amount: plan.matchedAmount,
      currencyCode: plan.currencyCode,
      documentDate: statementLine.transactionDate.toISOString().slice(0, 10),
      postingDate: statementLine.transactionDate.toISOString().slice(0, 10),
      narration: `Bank reconciliation match ${matchId}`,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })
    accountingVoucherId = posting.voucherId
    postingEventId = posting.postingEventId
  }

  const matchReference = await reserveBankReconciliationMatchReference(tenantId, plan.legalEntityId)

  const created = await prisma.$transaction(async (tx) => {
    await repo.lockSessionForUpdate(tx, tenantId, session.id)
    await repo.lockStatementLinesForUpdate(tx, tenantId, plan.statementAllocations.map((a) => a.bankStatementLineId))
    await repo.lockGeneralLedgerEntriesForUpdate(tx, tenantId, plan.ledgerAllocations.map((a) => a.generalLedgerEntryId))

    for (const alloc of plan.statementAllocations) {
      const line = await tx.bankStatementLine.findFirstOrThrow({ where: { id: alloc.bankStatementLineId, tenantId } })
      const remaining = toDecimal(line.amount).sub(line.matchedAmount)
      if (toDecimal(alloc.amount).gt(remaining)) throw new BankReconciliationConcurrentChangeError()
    }
    for (const alloc of plan.ledgerAllocations) {
      await repo.ensureLedgerPosition(tx, tenantId, plan.legalEntityId, alloc.entry)
      const position = await tx.bankLedgerReconciliationPosition.findFirstOrThrow({
        where: { generalLedgerEntryId: alloc.generalLedgerEntryId, tenantId },
      })
      if (toDecimal(alloc.amount).gt(position.unreconciledAmount)) throw new BankReconciliationConcurrentChangeError()
    }

    await repo.createMatchTx(tx, {
      id: matchId,
      tenantId,
      legalEntityId: plan.legalEntityId,
      branchId: session.branchId,
      reconciliationSessionId: session.id,
      treasuryAccountId: plan.treasuryAccountId,
      matchReference,
      matchMethod: options.matchMethodOverride ?? plan.matchMethod,
      matchSource: plan.matchSource,
      confidenceScore: options.confidenceScore ?? null,
      confidenceLevel: options.confidenceLevel ?? null,
      reasonCodes: options.reasonCodes ?? null,
      accountCurrencyCode: plan.currencyCode,
      matchedAmount: plan.matchedAmount,
      baseMatchedAmount: plan.matchedAmount,
      postingMode: plan.matchSource === 'CLEARING_GL' ? 'CLEARING_SETTLEMENT' : 'NONE',
      accountingVoucherId,
      postingEventId,
      note: plan.note,
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      matchedAt: new Date(),
      matchedById: context.userId,
      statementAllocations: plan.statementAllocations.map((a) => ({
        bankStatementLineId: a.bankStatementLineId,
        matchedAmount: a.amount,
        baseMatchedAmount: a.amount,
      })),
      ledgerAllocations: plan.ledgerAllocations.map((a) => ({
        generalLedgerEntryId: a.generalLedgerEntryId,
        accountingVoucherId: plan.matchSource === 'CLEARING_GL' ? accountingVoucherId : a.entry.voucherId,
        sourceDocumentType: a.entry.sourceDocumentType,
        sourceDocumentId: a.entry.sourceDocumentId,
        sourceDocumentNumber: null,
        accountId: a.accountId,
        accountCurrencyCode: plan.currencyCode,
        matchedAmount: a.amount,
        baseMatchedAmount: a.amount,
      })),
    })

    for (const alloc of plan.statementAllocations) {
      await repo.applyStatementLineAllocationDelta(tx, tenantId, alloc.bankStatementLineId, toDecimal(alloc.amount))
    }
    for (const alloc of plan.ledgerAllocations) {
      await repo.applyLedgerPositionDelta(tx, tenantId, alloc.generalLedgerEntryId, toDecimal(alloc.amount))
    }
    await repo.adjustSessionTotals(tx, tenantId, session.id, {
      matchedStatementAmount: toDecimal(plan.matchedAmount),
      matchedBookAmount: toDecimal(plan.matchedAmount),
    })

    return tx.bankReconciliationMatch.findFirstOrThrow({
      where: { id: matchId, tenantId },
      include: repo.MATCH_WITH_ALLOCATIONS_INCLUDE,
    })
  })

  await repo.invalidateConflictingSuggestions(
    tenantId,
    session.id,
    plan.statementAllocations.map((a) => a.bankStatementLineId),
    plan.ledgerAllocations.map((a) => a.generalLedgerEntryId),
  )

  await auditBankReconciliation(context, 'bank_reconciliation_match', matchId, 'BANK_RECON_MATCH_CREATED', {
    matchReference,
    matchSource: plan.matchSource,
    matchMethod: options.matchMethodOverride ?? plan.matchMethod,
    matchedAmount: plan.matchedAmount,
    statementLineCount: plan.statementAllocations.length,
    ledgerEntryCount: plan.ledgerAllocations.length,
  })

  return toMatchDto(created as repo.BankReconciliationMatchWithAllocations, false)
}

export function matchRowToDto(match: repo.BankReconciliationMatchWithAllocations): BankReconciliationMatchDto {
  return toMatchDto(match)
}

/** Manual match creation (direct or clearing, single/grouped/partial — all resolved by buildMatchPlan). */
export async function createMatch(
  tenantId: string,
  input: CreateMatchInput,
  context: ReconciliationContext,
): Promise<BankReconciliationMatchDto> {
  return executeMatch(tenantId, input, context)
}

export async function getMatch(tenantId: string, matchId: string): Promise<BankReconciliationMatchDto> {
  const match = await repo.getMatchByIdOrThrow(tenantId, matchId)
  return toMatchDto(match)
}
