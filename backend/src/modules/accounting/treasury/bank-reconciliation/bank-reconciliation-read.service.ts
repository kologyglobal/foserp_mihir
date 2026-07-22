import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { findCandidatesForLine } from './bank-reconciliation-candidate.service.js'
import { toSessionDto } from './bank-reconciliation-finalize.service.js'
import { matchRowToDto } from './bank-reconciliation-match.service.js'
import { scoreCandidates } from './bank-reconciliation-scoring.service.js'
import { getOrCreateSession } from './bank-reconciliation-session.service.js'
import { getEffectiveMatchingSettings } from './bank-reconciliation-settings.helper.js'
import { listPendingSuggestions } from './bank-reconciliation-suggestion.service.js'
import * as repo from './bank-reconciliation.repository.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import type {
  ListExceptionsQueryInput,
  ListHistoryQueryInput,
  ListSessionsQueryInput,
} from './bank-reconciliation.schemas.js'
import type { SessionSummaryDto } from './bank-reconciliation.types.js'

function serializeLine(line: Awaited<ReturnType<typeof readRepo.getStatementLineOrThrow>>) {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    transactionDate: line.transactionDate.toISOString().slice(0, 10),
    direction: line.direction,
    amount: formatForPersistence(line.amount),
    matchedAmount: formatForPersistence(line.matchedAmount),
    remainingAmount: formatForPersistence(toDecimal(line.amount).sub(line.matchedAmount)),
    matchStatus: line.matchStatus,
    description: line.description,
    referenceNumber: line.referenceNumber,
    utrReference: line.utrReference,
    chequeNumber: line.chequeNumber,
    linkedJournalId: line.linkedJournalId,
  }
}

export async function listSessions(tenantId: string, query: ListSessionsQueryInput) {
  const result = await readRepo.listSessions(tenantId, query)
  return {
    items: result.items.map(toSessionDto),
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  }
}

export async function listHistory(tenantId: string, query: ListHistoryQueryInput) {
  const result = await readRepo.listFinalizedSessions(tenantId, query)
  return {
    items: result.items.map(toSessionDto),
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  }
}

export async function listExceptions(tenantId: string, query: ListExceptionsQueryInput) {
  const result = await readRepo.listExceptions(tenantId, query)
  return {
    items: result.items,
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  }
}

/** Entry-point workspace for a statement's reconciliation screen — creates the session on first visit. */
export async function getWorkspace(tenantId: string, userId: string, statementId: string) {
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const session = await getOrCreateSession(tenantId, userId, statementId)
  const [lines, activeMatches, pendingSuggestions] = await Promise.all([
    readRepo.listStatementLines(tenantId, statementId),
    repo.listActiveMatchesForSession(tenantId, session.id),
    listPendingSuggestions(tenantId, session.id),
  ])

  return {
    session: toSessionDto(session),
    statement: {
      id: statement.id,
      status: statement.status,
      currencyCode: statement.currencyCode,
      periodStartDate: statement.periodStartDate.toISOString().slice(0, 10),
      periodEndDate: statement.periodEndDate.toISOString().slice(0, 10),
    },
    lines: lines.map(serializeLine),
    activeMatchCount: activeMatches.length,
    pendingSuggestionCount: pendingSuggestions.length,
  }
}

export async function getSummary(tenantId: string, statementId: string): Promise<SessionSummaryDto> {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)
  const [counts, openExceptionCount, pendingSuggestions, activeMatches] = await Promise.all([
    readRepo.countLinesByMatchStatus(tenantId, statementId),
    repo.countOpenExceptionsForSession(tenantId, session.id),
    listPendingSuggestions(tenantId, session.id),
    repo.listActiveMatchesForSession(tenantId, session.id),
  ])

  const lineCount = Object.values(counts).reduce((acc, v) => acc + v, 0)

  return {
    ...toSessionDto(session),
    lineCount,
    matchedLineCount: counts.MATCHED ?? 0,
    unmatchedLineCount: counts.UNMATCHED ?? 0,
    partiallyMatchedLineCount: counts.PARTIALLY_MATCHED ?? 0,
    exceptionLineCount: counts.EXCEPTION ?? 0,
    excludedLineCount: counts.EXCLUDED ?? 0,
    openExceptionCount,
    pendingSuggestionCount: pendingSuggestions.length,
    activeMatchCount: activeMatches.length,
  }
}

export async function listCandidatesForLine(tenantId: string, statementId: string, lineId: string) {
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const line = await readRepo.getStatementLineOrThrow(tenantId, statementId, lineId)
  const settings = await getEffectiveMatchingSettings(tenantId, statement.treasuryAccountId)
  const { direct, clearing } = await findCandidatesForLine(tenantId, statement, line)

  return {
    direct: scoreCandidates(line, direct, settings),
    clearing: scoreCandidates(line, clearing, settings),
  }
}

export async function listMatchesForSession(tenantId: string, statementId: string, page: number, limit: number) {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)
  const skip = (page - 1) * limit
  const result = await repo.listMatchesForSession(tenantId, session.id, skip, limit)
  return {
    items: result.items.map(matchRowToDto),
    meta: buildPaginationMeta(result.total, page, limit),
  }
}
