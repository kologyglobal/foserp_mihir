import type { BankReconciliationSession, BankStatement } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { hashPayload } from '../../shared/payload-hash.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import { findCandidatesForLine } from './bank-reconciliation-candidate.service.js'
import { findExactGroupCombinations, type GroupableItem } from './bank-reconciliation-grouping.service.js'
import { executeMatch, matchRowToDto } from './bank-reconciliation-match.service.js'
import { scoreCandidates } from './bank-reconciliation-scoring.service.js'
import { getEffectiveMatchingSettings } from './bank-reconciliation-settings.helper.js'
import * as repo from './bank-reconciliation.repository.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { BankReconciliationSuggestionNotPendingError } from './bank-reconciliation.errors.js'
import type {
  BankReconciliationMatchDto,
  LedgerCandidatePool,
  ReconciliationContext,
  ScoredLedgerCandidateDto,
  SuggestionDto,
} from './bank-reconciliation.types.js'

function toSuggestionDto(row: {
  id: string
  reconciliationSessionId: string
  suggestionReference: string
  suggestionType: SuggestionDto['suggestionType']
  confidenceScore: unknown
  confidenceLevel: string
  reasonCodes: unknown
  statementLineIds: unknown
  ledgerEntryIds: unknown
  suggestedAmount: string
  postingMode: SuggestionDto['postingMode']
  status: SuggestionDto['status']
  createdAt: Date
  updatedAt: Date
}): SuggestionDto {
  return {
    id: row.id,
    reconciliationSessionId: row.reconciliationSessionId,
    suggestionReference: row.suggestionReference,
    suggestionType: row.suggestionType,
    confidenceScore: toDecimal(row.confidenceScore as never).toFixed(2),
    confidenceLevel: row.confidenceLevel,
    reasonCodes: row.reasonCodes,
    statementLineIds: row.statementLineIds as string[],
    ledgerEntryIds: row.ledgerEntryIds as string[],
    suggestedAmount: row.suggestedAmount,
    postingMode: row.postingMode,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function nextSuggestionReference(tenantId: string, sessionId: string): Promise<string> {
  const count = await repo.countSuggestionsForSession(tenantId, sessionId)
  return `SUGG-${String(count + 1).padStart(6, '0')}`
}

function postingModeForPool(pool: LedgerCandidatePool): 'NONE' | 'CLEARING_SETTLEMENT' {
  return pool === 'DIRECT_BANK_GL' ? 'NONE' : 'CLEARING_SETTLEMENT'
}

async function persistSuggestion(
  tenantId: string,
  legalEntityId: string,
  sessionId: string,
  suggestionType: SuggestionDto['suggestionType'],
  statementLineIds: string[],
  ledgerEntryIds: string[],
  suggestedAmount: string,
  pool: LedgerCandidatePool,
  score: number,
  reasonCodes: string[],
): Promise<SuggestionDto> {
  const payloadHash = hashPayload({
    sessionId,
    statementLineIds: [...statementLineIds].sort(),
    ledgerEntryIds: [...ledgerEntryIds].sort(),
    suggestedAmount,
  })
  const reference = await nextSuggestionReference(tenantId, sessionId)
  const confidenceLevel = score >= 90 ? 'HIGH' : score >= 70 ? 'MEDIUM' : 'LOW'
  const created = await repo.createSuggestion({
    tenantId,
    legalEntityId,
    reconciliationSessionId: sessionId,
    suggestionReference: reference,
    suggestionType,
    confidenceScore: score.toFixed(2),
    confidenceLevel,
    reasonCodes,
    statementLineIds,
    ledgerEntryIds,
    suggestedAmount,
    postingMode: postingModeForPool(pool),
    payloadHash,
  })
  return toSuggestionDto(created)
}

/**
 * Generates PENDING suggestions for every UNMATCHED / PARTIALLY_MATCHED line in the statement
 * that does not already have a pending suggestion. Never mixes DIRECT and CLEARING pools within
 * one suggestion (rule #5). Tries DIRECT candidates before CLEARING (simpler / no posting first).
 */
export async function generateSuggestionsForSession(
  tenantId: string,
  statement: BankStatement,
  session: BankReconciliationSession,
): Promise<SuggestionDto[]> {
  const settings = await getEffectiveMatchingSettings(tenantId, statement.treasuryAccountId)
  const lines = await readRepo.listStatementLines(tenantId, statement.id)
  const openLines = lines.filter((l) => l.matchStatus === 'UNMATCHED' || l.matchStatus === 'PARTIALLY_MATCHED')

  const existingPending = new Set(
    (await repo.findPendingSuggestionsForSession(tenantId, session.id)).flatMap((s) => s.statementLineIds as string[]),
  )

  const created: SuggestionDto[] = []
  const consumedEntryIds = new Set<string>()

  for (const line of openLines) {
    if (existingPending.has(line.id)) continue
    const target = toDecimal(line.amount).sub(line.matchedAmount).toFixed(4)
    if (toDecimal(target).lte(0)) continue

    const { direct, clearing } = await findCandidatesForLine(tenantId, statement, line)
    const pools: Array<{ pool: LedgerCandidatePool; candidates: typeof direct }> = [
      { pool: 'DIRECT_BANK_GL', candidates: direct.filter((c) => !consumedEntryIds.has(c.generalLedgerEntryId)) },
      { pool: 'CLEARING_GL', candidates: clearing.filter((c) => !consumedEntryIds.has(c.generalLedgerEntryId)) },
    ]

    let matchedForLine = false
    for (const { pool, candidates } of pools) {
      if (matchedForLine || candidates.length === 0) continue
      const scored = scoreCandidates(line, candidates, settings)
      const exact = scored.find((c) => toDecimal(c.unreconciledAmount).eq(target) && c.score >= settings.minimumSuggestionScore)
      if (exact) {
        created.push(
          await persistSuggestion(
            tenantId,
            statement.legalEntityId,
            session.id,
            'ONE_TO_ONE',
            [line.id],
            [exact.generalLedgerEntryId],
            target,
            pool,
            exact.score,
            exact.reasonCodes,
          ),
        )
        consumedEntryIds.add(exact.generalLedgerEntryId)
        matchedForLine = true
        continue
      }

      if (settings.groupedSuggestionsEnabled && scored.length >= 2) {
        const items: Array<GroupableItem & { score: number; candidate: ScoredLedgerCandidateDto }> = scored.map((c) => ({
          id: c.generalLedgerEntryId,
          amount: c.unreconciledAmount,
          score: c.score,
          candidate: c,
        }))
        const combos = findExactGroupCombinations(items, target, settings.maximumGroupSize)
        const best = combos.find((combo) => combo.averageScore >= settings.minimumSuggestionScore)
        if (best) {
          created.push(
            await persistSuggestion(
              tenantId,
              statement.legalEntityId,
              session.id,
              'ONE_TO_MANY',
              [line.id],
              best.items.map((i) => i.id),
              target,
              pool,
              best.averageScore,
              ['GROUPED_EXACT_SUM'],
            ),
          )
          for (const i of best.items) consumedEntryIds.add(i.id)
          matchedForLine = true
          continue
        }
      }

      if (!matchedForLine && settings.partialSuggestionsEnabled && scored.length > 0) {
        const best = scored[0]
        if (best.score >= settings.minimumSuggestionScore) {
          const suggestedAmount = toDecimal(target).lte(best.unreconciledAmount) ? target : best.unreconciledAmount
          created.push(
            await persistSuggestion(
              tenantId,
              statement.legalEntityId,
              session.id,
              'ONE_TO_ONE',
              [line.id],
              [best.generalLedgerEntryId],
              suggestedAmount,
              pool,
              best.score,
              [...best.reasonCodes, 'PARTIAL_SUGGESTION'],
            ),
          )
          matchedForLine = true
        }
      }
    }
  }

  return created
}

export async function listPendingSuggestions(tenantId: string, sessionId: string): Promise<SuggestionDto[]> {
  const rows = await repo.findPendingSuggestionsForSession(tenantId, sessionId)
  return rows.map(toSuggestionDto)
}

export function suggestionRowToDto(row: Parameters<typeof toSuggestionDto>[0]): SuggestionDto {
  return toSuggestionDto(row)
}

/**
 * Accepting a suggestion re-derives current allocation amounts (statement line remaining amount,
 * ledger entries' current unreconciled amounts) rather than trusting the (possibly stale)
 * suggestedAmount snapshot, then delegates to the same `executeMatch` engine used for manual
 * matches. Idempotent: replaying the same idempotencyKey returns the original match, even if the
 * suggestion has since flipped to ACCEPTED.
 */
export async function acceptSuggestion(
  tenantId: string,
  suggestionId: string,
  idempotencyKey: string,
  context: ReconciliationContext,
): Promise<BankReconciliationMatchDto> {
  const existingMatch = await repo.findMatchByIdempotencyKey(tenantId, idempotencyKey)
  if (existingMatch) return matchRowToDto(existingMatch)

  const suggestion = await repo.getSuggestionOrThrow(tenantId, suggestionId)
  if (suggestion.status !== 'PENDING') {
    throw new BankReconciliationSuggestionNotPendingError()
  }

  const session = await repo.getSessionOrThrow(tenantId, suggestion.reconciliationSessionId)
  const statementLineIds = suggestion.statementLineIds as string[]
  const ledgerEntryIds = suggestion.ledgerEntryIds as string[]

  const lines = await readRepo.getStatementLinesByIds(tenantId, session.bankStatementId, statementLineIds)
  const entries = await readRepo.getGeneralLedgerEntriesByIds(tenantId, ledgerEntryIds)
  const requiredSide = lines[0].direction === 'CREDIT' ? 'DEBIT' : 'CREDIT'

  const statementAllocations = lines.map((line) => ({
    bankStatementLineId: line.id,
    amount: toDecimal(line.amount).sub(line.matchedAmount).toFixed(4),
  }))
  const ledgerAllocations = await Promise.all(
    entries.map(async (entry) => {
      const position = await prisma.bankLedgerReconciliationPosition.findFirst({ where: { tenantId, generalLedgerEntryId: entry.id } })
      const amount = position
        ? toDecimal(position.unreconciledAmount)
        : toDecimal(requiredSide === 'DEBIT' ? entry.debitAmount : entry.creditAmount)
      return { generalLedgerEntryId: entry.id, amount: amount.toFixed(4) }
    }),
  )

  const match = await executeMatch(
    tenantId,
    {
      statementId: session.bankStatementId,
      statementAllocations,
      ledgerAllocations,
      note: `Accepted suggestion ${suggestion.suggestionReference}`,
      idempotencyKey,
    },
    context,
    {
      matchMethodOverride: 'AUTO_ACCEPTED',
      confidenceScore: toDecimal(suggestion.confidenceScore).toFixed(2),
      confidenceLevel: suggestion.confidenceLevel,
      reasonCodes: suggestion.reasonCodes,
    },
  )

  await repo.updateSuggestionStatus(tenantId, suggestionId, 'ACCEPTED', context.userId)
  await auditBankReconciliation(context, 'bank_reconciliation_suggestion', suggestionId, 'BANK_RECON_SUGGESTION_ACCEPTED', {
    matchId: match.id,
  })

  return match
}

export async function rejectSuggestion(
  tenantId: string,
  suggestionId: string,
  reason: string | null | undefined,
  context: ReconciliationContext,
): Promise<SuggestionDto> {
  const suggestion = await repo.getSuggestionOrThrow(tenantId, suggestionId)
  if (suggestion.status !== 'PENDING') {
    // Idempotent no-op replay for an already-rejected suggestion; any other status is an error.
    if (suggestion.status === 'REJECTED') return toSuggestionDto(suggestion)
    throw new BankReconciliationSuggestionNotPendingError()
  }

  const updated = await repo.updateSuggestionStatus(tenantId, suggestionId, 'REJECTED', context.userId)
  await auditBankReconciliation(context, 'bank_reconciliation_suggestion', suggestionId, 'BANK_RECON_SUGGESTION_REJECTED', { reason })

  return toSuggestionDto(updated)
}
