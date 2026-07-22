import type { BankReconciliationSession, BankStatement } from '@prisma/client'
import { toDecimal } from '../../shared/finance-decimal.js'
import { findCandidatesForLine } from './bank-reconciliation-candidate.service.js'
import { executeMatch } from './bank-reconciliation-match.service.js'
import { scoreCandidates } from './bank-reconciliation-scoring.service.js'
import { getEffectiveMatchingSettings } from './bank-reconciliation-settings.helper.js'
import * as repo from './bank-reconciliation.repository.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import type { AutoMatchRunResultDto, BankReconciliationMatchDto, ReconciliationContext } from './bank-reconciliation.types.js'

/**
 * Exact-DIRECT-only auto-matching. Never touches CLEARING candidates and never auto-posts
 * (DIRECT matches never create a voucher). Only matches a line when there is exactly one unique
 * EXACT-amount DIRECT candidate and the treasury account's settings allow it.
 */
export async function runAutoMatch(
  tenantId: string,
  statement: BankStatement,
  session: BankReconciliationSession,
  context: ReconciliationContext,
): Promise<AutoMatchRunResultDto> {
  const startedAt = Date.now()
  const settings = await getEffectiveMatchingSettings(tenantId, statement.treasuryAccountId)
  const matchRun = await repo.createMatchRun(tenantId, statement.legalEntityId, session.id, context.userId, settings)

  const lines = (await readRepo.listStatementLines(tenantId, statement.id)).filter((l) => l.matchStatus === 'UNMATCHED')

  let matchesCreated = 0
  let ambiguousLines = 0
  let noCandidateLines = 0
  const matches: BankReconciliationMatchDto[] = []

  if (!settings.autoReconcileEnabled) {
    await repo.completeMatchRun(tenantId, matchRun.id, {
      status: 'COMPLETED',
      linesScanned: lines.length,
      matchesCreated: 0,
      suggestionsCreated: 0,
      ambiguousLines: 0,
      noCandidateLines: 0,
      postingRequiredSuggestions: 0,
      durationMs: Date.now() - startedAt,
    })
    return {
      matchRunId: matchRun.id,
      status: 'COMPLETED',
      linesScanned: lines.length,
      matchesCreated: 0,
      suggestionsCreated: 0,
      ambiguousLines: 0,
      noCandidateLines: 0,
      durationMs: Date.now() - startedAt,
      matches: [],
    }
  }

  try {
    for (const line of lines) {
      const target = toDecimal(line.amount).sub(line.matchedAmount)
      const { direct } = await findCandidatesForLine(tenantId, statement, line)
      if (direct.length === 0) {
        noCandidateLines += 1
        continue
      }
      const scored = scoreCandidates(line, direct, settings)
      const exactMatches = scored.filter(
        (c) => toDecimal(c.unreconciledAmount).eq(target) && c.score >= settings.autoReconcileScore,
      )

      if (exactMatches.length === 0) {
        continue
      }
      if (exactMatches.length > 1 && settings.requireUniqueExactMatch) {
        ambiguousLines += 1
        continue
      }

      const best = exactMatches[0]
      const idempotencyKey = `AUTO_MATCH:${line.id}:${best.generalLedgerEntryId}`
      const match = await executeMatch(
        tenantId,
        {
          statementId: statement.id,
          statementAllocations: [{ bankStatementLineId: line.id, amount: target.toFixed(4) }],
          ledgerAllocations: [{ generalLedgerEntryId: best.generalLedgerEntryId, amount: target.toFixed(4) }],
          idempotencyKey,
        },
        context,
        {
          matchMethodOverride: 'AUTO_EXACT',
          confidenceScore: best.score.toFixed(2),
          confidenceLevel: best.confidenceLevel,
          reasonCodes: best.reasonCodes,
        },
      )
      matches.push(match)
      matchesCreated += 1
    }

    await repo.completeMatchRun(tenantId, matchRun.id, {
      status: 'COMPLETED',
      linesScanned: lines.length,
      matchesCreated,
      suggestionsCreated: 0,
      ambiguousLines,
      noCandidateLines,
      postingRequiredSuggestions: 0,
      durationMs: Date.now() - startedAt,
    })

    return {
      matchRunId: matchRun.id,
      status: 'COMPLETED',
      linesScanned: lines.length,
      matchesCreated,
      suggestionsCreated: 0,
      ambiguousLines,
      noCandidateLines,
      durationMs: Date.now() - startedAt,
      matches,
    }
  } catch (error) {
    await repo.completeMatchRun(tenantId, matchRun.id, {
      status: 'FAILED',
      linesScanned: lines.length,
      matchesCreated,
      suggestionsCreated: 0,
      ambiguousLines,
      noCandidateLines,
      postingRequiredSuggestions: 0,
      durationMs: Date.now() - startedAt,
      errorCode: 'AUTO_MATCH_FAILED',
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Auto-match run failed',
    })
    throw error
  }
}

