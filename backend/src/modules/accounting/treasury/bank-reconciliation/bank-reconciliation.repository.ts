import type {
  BankLedgerReconciliationPositionStatus,
  BankReconciliationException,
  BankReconciliationMatch,
  BankReconciliationMatchRun,
  BankReconciliationSession,
  BankReconciliationSuggestion,
  BankStatementLineMatchStatus,
  GeneralLedgerEntry,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import {
  BankReconciliationExceptionNotFoundError,
  BankReconciliationMatchNotFoundError,
  BankReconciliationSessionNotFoundError,
  BankReconciliationSuggestionNotFoundError,
} from './bank-reconciliation.errors.js'

type Tx = Prisma.TransactionClient

// ─── Sessions ──────────────────────────────────────────────────────────────────

export async function findSessionByStatementId(
  tenantId: string,
  bankStatementId: string,
): Promise<BankReconciliationSession | null> {
  return prisma.bankReconciliationSession.findFirst({ where: { tenantId, bankStatementId } })
}

export async function getSessionOrThrow(tenantId: string, id: string): Promise<BankReconciliationSession> {
  const session = await prisma.bankReconciliationSession.findFirst({ where: { id, tenantId } })
  if (!session) throw new BankReconciliationSessionNotFoundError()
  return session
}

export async function getSessionByStatementIdOrThrow(
  tenantId: string,
  bankStatementId: string,
): Promise<BankReconciliationSession> {
  const session = await findSessionByStatementId(tenantId, bankStatementId)
  if (!session) throw new BankReconciliationSessionNotFoundError('No reconciliation session exists for this statement yet')
  return session
}

export interface CreateSessionData {
  tenantId: string
  legalEntityId: string
  branchId: string | null
  treasuryAccountId: string
  bankStatementId: string
  statementStartDate: Date
  statementEndDate: Date
  statementOpeningBalance: string | null
  statementClosingBalance: string | null
  totalStatementDebit: string
  totalStatementCredit: string
  createdById: string
}

export async function createSession(data: CreateSessionData): Promise<BankReconciliationSession> {
  return prisma.bankReconciliationSession.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      branchId: data.branchId,
      treasuryAccountId: data.treasuryAccountId,
      bankStatementId: data.bankStatementId,
      status: 'OPEN',
      statementStartDate: data.statementStartDate,
      statementEndDate: data.statementEndDate,
      statementOpeningBalance: data.statementOpeningBalance,
      statementClosingBalance: data.statementClosingBalance,
      totalStatementDebit: data.totalStatementDebit,
      totalStatementCredit: data.totalStatementCredit,
      matchedStatementAmount: 0,
      unmatchedStatementAmount: toDecimal(data.totalStatementDebit).add(data.totalStatementCredit),
      matchedBookAmount: 0,
      unmatchedBookAmount: 0,
      createdById: data.createdById,
    },
  })
}

export async function lockSessionForUpdate(tx: Tx, tenantId: string, sessionId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM bank_reconciliation_sessions
    WHERE id = ${sessionId} AND tenantId = ${tenantId}
    FOR UPDATE
  `
}

export async function adjustSessionTotals(
  tx: Tx,
  tenantId: string,
  sessionId: string,
  delta: { matchedStatementAmount: Prisma.Decimal; matchedBookAmount: Prisma.Decimal },
): Promise<BankReconciliationSession> {
  const session = await tx.bankReconciliationSession.findFirstOrThrow({ where: { id: sessionId, tenantId } })
  const matchedStatementAmount = toDecimal(session.matchedStatementAmount).add(delta.matchedStatementAmount)
  const unmatchedStatementAmount = toDecimal(session.totalStatementDebit)
    .add(session.totalStatementCredit)
    .sub(matchedStatementAmount)
  const matchedBookAmount = toDecimal(session.matchedBookAmount).add(delta.matchedBookAmount)
  return tx.bankReconciliationSession.update({
    where: { id: sessionId },
    data: {
      matchedStatementAmount: formatForPersistence(matchedStatementAmount),
      unmatchedStatementAmount: formatForPersistence(unmatchedStatementAmount),
      matchedBookAmount: formatForPersistence(matchedBookAmount),
      status: session.status === 'OPEN' ? 'IN_PROGRESS' : session.status,
    },
  })
}

export async function setSessionStatus(
  tenantId: string,
  sessionId: string,
  data: Prisma.BankReconciliationSessionUpdateInput,
): Promise<BankReconciliationSession> {
  await getSessionOrThrow(tenantId, sessionId)
  return prisma.bankReconciliationSession.update({ where: { id: sessionId }, data })
}

// ─── Statement lines / GL positions ────────────────────────────────────────────

export async function lockStatementLinesForUpdate(tx: Tx, tenantId: string, lineIds: string[]): Promise<void> {
  const sorted = [...lineIds].sort()
  for (const id of sorted) {
    await tx.$queryRaw`
      SELECT id FROM bank_statement_lines
      WHERE id = ${id} AND tenantId = ${tenantId}
      FOR UPDATE
    `
  }
}

export async function lockGeneralLedgerEntriesForUpdate(tx: Tx, tenantId: string, entryIds: string[]): Promise<void> {
  const sorted = [...entryIds].sort()
  for (const id of sorted) {
    await tx.$queryRaw`
      SELECT id FROM general_ledger_entries
      WHERE id = ${id} AND tenantId = ${tenantId}
      FOR UPDATE
    `
  }
}

export async function applyStatementLineAllocationDelta(
  tx: Tx,
  tenantId: string,
  lineId: string,
  matchedAmountDelta: Prisma.Decimal,
  linkedJournalId?: string | null,
): Promise<void> {
  const line = await tx.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId } })
  const newMatchedAmount = toDecimal(line.matchedAmount).add(matchedAmountDelta)
  const status: BankStatementLineMatchStatus = resolveLineMatchStatus(newMatchedAmount, toDecimal(line.amount))
  await tx.bankStatementLine.update({
    where: { id: lineId },
    data: {
      matchedAmount: formatForPersistence(newMatchedAmount),
      matchStatus: status,
      ...(linkedJournalId !== undefined ? { linkedJournalId } : {}),
    },
  })
}

export function resolveLineMatchStatus(matchedAmount: Prisma.Decimal, lineAmount: Prisma.Decimal): BankStatementLineMatchStatus {
  if (matchedAmount.lte(0)) return 'UNMATCHED'
  if (matchedAmount.gte(lineAmount)) return 'MATCHED'
  return 'PARTIALLY_MATCHED'
}

export async function ensureLedgerPosition(
  tx: Tx,
  tenantId: string,
  legalEntityId: string,
  entry: GeneralLedgerEntry,
): Promise<{ id: string; unreconciledAmount: Prisma.Decimal }> {
  const existing = await tx.bankLedgerReconciliationPosition.findFirst({
    where: { generalLedgerEntryId: entry.id, tenantId },
  })
  if (existing) {
    return { id: existing.id, unreconciledAmount: toDecimal(existing.unreconciledAmount) }
  }
  const originalAmount = toDecimal(entry.debitAmount).gt(0) ? toDecimal(entry.debitAmount) : toDecimal(entry.creditAmount)
  const created = await tx.bankLedgerReconciliationPosition.create({
    data: {
      tenantId,
      legalEntityId,
      generalLedgerEntryId: entry.id,
      originalAmount: formatForPersistence(originalAmount),
      reconciledAmount: 0,
      unreconciledAmount: formatForPersistence(originalAmount),
      status: 'UNRECONCILED',
    },
  })
  return { id: created.id, unreconciledAmount: toDecimal(created.unreconciledAmount) }
}

export async function applyLedgerPositionDelta(
  tx: Tx,
  tenantId: string,
  generalLedgerEntryId: string,
  reconciledDelta: Prisma.Decimal,
): Promise<void> {
  const position = await tx.bankLedgerReconciliationPosition.findFirstOrThrow({
    where: { generalLedgerEntryId, tenantId },
  })
  const reconciledAmount = toDecimal(position.reconciledAmount).add(reconciledDelta)
  const unreconciledAmount = toDecimal(position.originalAmount).sub(reconciledAmount)
  let status: BankLedgerReconciliationPositionStatus = 'UNRECONCILED'
  if (reconciledAmount.gte(position.originalAmount)) status = 'FULLY_RECONCILED'
  else if (reconciledAmount.gt(0)) status = 'PARTIALLY_RECONCILED'
  await tx.bankLedgerReconciliationPosition.update({
    where: { id: position.id },
    data: {
      reconciledAmount: formatForPersistence(reconciledAmount),
      unreconciledAmount: formatForPersistence(unreconciledAmount),
      status,
      version: { increment: 1 },
    },
  })
}

// ─── Matches ───────────────────────────────────────────────────────────────────

export const MATCH_WITH_ALLOCATIONS_INCLUDE = {
  statementAllocations: true,
  ledgerAllocations: true,
} as const

export type BankReconciliationMatchWithAllocations = BankReconciliationMatch & {
  statementAllocations: Array<{ id: string; bankStatementLineId: string; matchedAmount: Prisma.Decimal }>
  ledgerAllocations: Array<{
    id: string
    generalLedgerEntryId: string
    accountingVoucherId: string | null
    accountId: string
    sourceDocumentType: string | null
    sourceDocumentId: string | null
    sourceDocumentNumber: string | null
    matchedAmount: Prisma.Decimal
  }>
}

export async function findMatchByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string,
): Promise<BankReconciliationMatchWithAllocations | null> {
  return prisma.bankReconciliationMatch.findFirst({
    where: { tenantId, idempotencyKey },
    include: MATCH_WITH_ALLOCATIONS_INCLUDE,
  })
}

export async function getMatchByIdOrThrow(
  tenantId: string,
  matchId: string,
): Promise<BankReconciliationMatchWithAllocations> {
  const match = await prisma.bankReconciliationMatch.findFirst({
    where: { id: matchId, tenantId },
    include: MATCH_WITH_ALLOCATIONS_INCLUDE,
  })
  if (!match) throw new BankReconciliationMatchNotFoundError()
  return match
}

export interface CreateMatchTxInput {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  reconciliationSessionId: string
  treasuryAccountId: string
  matchReference: string
  matchMethod: BankReconciliationMatch['matchMethod']
  matchSource: BankReconciliationMatch['matchSource']
  confidenceScore?: string | null
  confidenceLevel?: string | null
  reasonCodes?: unknown
  accountCurrencyCode: string
  matchedAmount: string
  baseMatchedAmount: string
  postingMode: BankReconciliationMatch['postingMode']
  accountingVoucherId?: string | null
  postingEventId?: string | null
  note?: string | null
  idempotencyKey: string
  payloadHash: string
  matchedAt: Date
  matchedById: string
  statementAllocations: Array<{ bankStatementLineId: string; matchedAmount: string; baseMatchedAmount: string }>
  ledgerAllocations: Array<{
    generalLedgerEntryId: string
    accountingVoucherId?: string | null
    sourceDocumentType?: string | null
    sourceDocumentId?: string | null
    sourceDocumentNumber?: string | null
    accountId: string
    accountCurrencyCode: string
    matchedAmount: string
    baseMatchedAmount: string
  }>
}

export async function createMatchTx(tx: Tx, input: CreateMatchTxInput): Promise<BankReconciliationMatch> {
  const match = await tx.bankReconciliationMatch.create({
    data: {
      id: input.id,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId,
      reconciliationSessionId: input.reconciliationSessionId,
      treasuryAccountId: input.treasuryAccountId,
      matchReference: input.matchReference,
      matchMethod: input.matchMethod,
      matchSource: input.matchSource,
      matchStatus: 'ACTIVE',
      confidenceScore: input.confidenceScore ?? null,
      confidenceLevel: input.confidenceLevel ?? null,
      reasonCodes: input.reasonCodes as Prisma.InputJsonValue,
      accountCurrencyCode: input.accountCurrencyCode,
      matchedAmount: input.matchedAmount,
      baseMatchedAmount: input.baseMatchedAmount,
      postingMode: input.postingMode,
      accountingVoucherId: input.accountingVoucherId ?? null,
      postingEventId: input.postingEventId ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      matchedAt: input.matchedAt,
      matchedById: input.matchedById,
    },
  })

  await tx.bankReconciliationStatementAllocation.createMany({
    data: input.statementAllocations.map((a) => ({
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      reconciliationMatchId: match.id,
      bankStatementLineId: a.bankStatementLineId,
      matchedAmount: a.matchedAmount,
      baseMatchedAmount: a.baseMatchedAmount,
    })),
  })

  await tx.bankReconciliationLedgerAllocation.createMany({
    data: input.ledgerAllocations.map((a) => ({
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      reconciliationMatchId: match.id,
      generalLedgerEntryId: a.generalLedgerEntryId,
      accountingVoucherId: a.accountingVoucherId ?? null,
      sourceDocumentType: a.sourceDocumentType ?? null,
      sourceDocumentId: a.sourceDocumentId ?? null,
      sourceDocumentNumber: a.sourceDocumentNumber ?? null,
      accountId: a.accountId,
      accountCurrencyCode: a.accountCurrencyCode,
      matchedAmount: a.matchedAmount,
      baseMatchedAmount: a.baseMatchedAmount,
    })),
  })

  return match
}

export async function markMatchReversedTx(
  tx: Tx,
  tenantId: string,
  matchId: string,
  data: { reversalReason: string; reversedById: string; reversalVoucherId?: string | null; reversalPostingEventId?: string | null },
): Promise<BankReconciliationMatch> {
  const result = await tx.bankReconciliationMatch.updateMany({
    where: { id: matchId, tenantId, matchStatus: 'ACTIVE' },
    data: {
      matchStatus: 'REVERSED',
      reversedAt: new Date(),
      reversedById: data.reversedById,
      reversalReason: data.reversalReason,
      reversalVoucherId: data.reversalVoucherId ?? undefined,
      reversalPostingEventId: data.reversalPostingEventId ?? undefined,
    },
  })
  if (result.count !== 1) throw new BankReconciliationMatchNotFoundError('Match already unmatched or not found')
  return tx.bankReconciliationMatch.findFirstOrThrow({ where: { id: matchId, tenantId } })
}

export async function listActiveMatchesForSession(tenantId: string, sessionId: string): Promise<BankReconciliationMatchWithAllocations[]> {
  return prisma.bankReconciliationMatch.findMany({
    where: { tenantId, reconciliationSessionId: sessionId, matchStatus: 'ACTIVE' },
    include: MATCH_WITH_ALLOCATIONS_INCLUDE,
    orderBy: { matchedAt: 'desc' },
  })
}

export async function listMatchesForSession(
  tenantId: string,
  sessionId: string,
  skip: number,
  take: number,
): Promise<{ items: BankReconciliationMatchWithAllocations[]; total: number }> {
  const where = { tenantId, reconciliationSessionId: sessionId }
  const [items, total] = await Promise.all([
    prisma.bankReconciliationMatch.findMany({
      where,
      include: MATCH_WITH_ALLOCATIONS_INCLUDE,
      orderBy: { matchedAt: 'desc' },
      skip,
      take,
    }),
    prisma.bankReconciliationMatch.count({ where }),
  ])
  return { items, total }
}

// ─── Suggestions ───────────────────────────────────────────────────────────────

export async function countSuggestionsForSession(tenantId: string, sessionId: string): Promise<number> {
  return prisma.bankReconciliationSuggestion.count({ where: { tenantId, reconciliationSessionId: sessionId } })
}

export interface CreateSuggestionInput {
  tenantId: string
  legalEntityId: string
  reconciliationSessionId: string
  suggestionReference: string
  suggestionType: BankReconciliationSuggestion['suggestionType']
  confidenceScore: string
  confidenceLevel: string
  reasonCodes: unknown
  statementLineIds: string[]
  ledgerEntryIds: string[]
  suggestedAmount: string
  postingMode: BankReconciliationSuggestion['postingMode']
  payloadHash: string
}

export async function createSuggestion(input: CreateSuggestionInput): Promise<BankReconciliationSuggestion> {
  return prisma.bankReconciliationSuggestion.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      reconciliationSessionId: input.reconciliationSessionId,
      suggestionReference: input.suggestionReference,
      suggestionType: input.suggestionType,
      confidenceScore: input.confidenceScore,
      confidenceLevel: input.confidenceLevel,
      reasonCodes: input.reasonCodes as Prisma.InputJsonValue,
      statementLineIds: input.statementLineIds as Prisma.InputJsonValue,
      ledgerEntryIds: input.ledgerEntryIds as Prisma.InputJsonValue,
      suggestedAmount: input.suggestedAmount,
      postingMode: input.postingMode,
      payloadHash: input.payloadHash,
      status: 'PENDING',
    },
  })
}

export async function findPendingSuggestionsForSession(tenantId: string, sessionId: string): Promise<BankReconciliationSuggestion[]> {
  return prisma.bankReconciliationSuggestion.findMany({
    where: { tenantId, reconciliationSessionId: sessionId, status: 'PENDING' },
    orderBy: { confidenceScore: 'desc' },
  })
}

export async function findPendingSuggestionsForLine(
  tenantId: string,
  sessionId: string,
  lineId: string,
): Promise<BankReconciliationSuggestion[]> {
  const all = await findPendingSuggestionsForSession(tenantId, sessionId)
  return all.filter((s) => (s.statementLineIds as string[]).includes(lineId))
}

export async function getSuggestionOrThrow(tenantId: string, suggestionId: string): Promise<BankReconciliationSuggestion> {
  const suggestion = await prisma.bankReconciliationSuggestion.findFirst({ where: { id: suggestionId, tenantId } })
  if (!suggestion) throw new BankReconciliationSuggestionNotFoundError()
  return suggestion
}

export async function updateSuggestionStatus(
  tenantId: string,
  suggestionId: string,
  status: BankReconciliationSuggestion['status'],
  resolvedById?: string | null,
): Promise<BankReconciliationSuggestion> {
  await getSuggestionOrThrow(tenantId, suggestionId)
  return prisma.bankReconciliationSuggestion.update({
    where: { id: suggestionId },
    data: {
      status,
      acceptedAt: status === 'ACCEPTED' ? new Date() : undefined,
      rejectedAt: status === 'REJECTED' ? new Date() : undefined,
      resolvedById: resolvedById ?? undefined,
    },
  })
}

export async function invalidateConflictingSuggestions(
  tenantId: string,
  sessionId: string,
  statementLineIds: string[],
  ledgerEntryIds: string[],
  excludeSuggestionId?: string,
): Promise<number> {
  const pending = await findPendingSuggestionsForSession(tenantId, sessionId)
  const lineSet = new Set(statementLineIds)
  const entrySet = new Set(ledgerEntryIds)
  const toInvalidate = pending.filter((s) => {
    if (s.id === excludeSuggestionId) return false
    const lines = s.statementLineIds as string[]
    const entries = s.ledgerEntryIds as string[]
    return lines.some((l) => lineSet.has(l)) || entries.some((e) => entrySet.has(e))
  })
  if (toInvalidate.length === 0) return 0
  await prisma.bankReconciliationSuggestion.updateMany({
    where: { id: { in: toInvalidate.map((s) => s.id) } },
    data: { status: 'INVALIDATED' },
  })
  return toInvalidate.length
}

// ─── Match runs ─────────────────────────────────────────────────────────────────

export async function createMatchRun(
  tenantId: string,
  legalEntityId: string,
  sessionId: string,
  startedById: string,
  settingsSnapshot: unknown,
): Promise<BankReconciliationMatchRun> {
  return prisma.bankReconciliationMatchRun.create({
    data: {
      tenantId,
      legalEntityId,
      reconciliationSessionId: sessionId,
      status: 'RUNNING',
      settingsSnapshot: settingsSnapshot as Prisma.InputJsonValue,
      startedById,
    },
  })
}

export async function completeMatchRun(
  tenantId: string,
  runId: string,
  data: {
    status: 'COMPLETED' | 'FAILED'
    linesScanned: number
    matchesCreated: number
    suggestionsCreated: number
    ambiguousLines: number
    noCandidateLines: number
    postingRequiredSuggestions: number
    durationMs: number
    errorCode?: string | null
    errorMessage?: string | null
  },
): Promise<BankReconciliationMatchRun> {
  return prisma.bankReconciliationMatchRun.update({
    where: { id: runId, tenantId },
    data: { ...data, completedAt: new Date() },
  })
}

// ─── Exceptions ─────────────────────────────────────────────────────────────────

export interface CreateExceptionInput {
  tenantId: string
  legalEntityId: string
  reconciliationSessionId: string
  bankStatementLineId: string
  reason: BankReconciliationException['reason']
  comment?: string | null
  assignedToId?: string | null
  createdById: string
}

export async function createException(input: CreateExceptionInput): Promise<BankReconciliationException> {
  return prisma.bankReconciliationException.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      reconciliationSessionId: input.reconciliationSessionId,
      bankStatementLineId: input.bankStatementLineId,
      reason: input.reason,
      comment: input.comment ?? null,
      status: 'OPEN',
      assignedToId: input.assignedToId ?? null,
      createdById: input.createdById,
    },
  })
}

export async function getExceptionOrThrow(tenantId: string, exceptionId: string): Promise<BankReconciliationException> {
  const exception = await prisma.bankReconciliationException.findFirst({ where: { id: exceptionId, tenantId } })
  if (!exception) throw new BankReconciliationExceptionNotFoundError()
  return exception
}

export async function resolveExceptionRecord(
  tenantId: string,
  exceptionId: string,
  data: { resolvedById: string; resolutionReference?: string | null; comment?: string | null },
): Promise<BankReconciliationException> {
  await getExceptionOrThrow(tenantId, exceptionId)
  return prisma.bankReconciliationException.update({
    where: { id: exceptionId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: data.resolvedById,
      resolutionReference: data.resolutionReference ?? null,
      comment: data.comment ?? undefined,
    },
  })
}

export async function listExceptionsForSession(tenantId: string, sessionId: string): Promise<BankReconciliationException[]> {
  return prisma.bankReconciliationException.findMany({
    where: { tenantId, reconciliationSessionId: sessionId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function countOpenExceptionsForSession(tenantId: string, sessionId: string): Promise<number> {
  return prisma.bankReconciliationException.count({
    where: { tenantId, reconciliationSessionId: sessionId, status: 'OPEN' },
  })
}
