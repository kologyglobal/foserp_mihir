import { prisma } from '../../../../config/prisma.js'
import type { ImportIssueInput } from './bank-statement.types.js'

export type LineSupersessionOutcome =
  | { action: 'CREATE'; isProvisional: boolean; supersededByLineId?: undefined }
  | { action: 'CREATE_EXCLUDED'; isProvisional: boolean; supersededByLineId: string }
  | { action: 'SKIP_DUPLICATE' }
  | {
      action: 'CREATE_AND_SUPERSEDE'
      isProvisional: false
      provisionalLineId: string
    }
  | {
      action: 'BLOCK_ACTIVE_MATCH'
      provisionalLineId: string
      issue: ImportIssueInput
    }

/**
 * Decide how to handle a new statement line that collides on lineHash with an existing line.
 *
 * Rules:
 * - Provisional vs existing canonical → create excluded provisional linked to canonical
 * - Canonical vs existing unmatched provisional → create canonical and supersede provisional
 * - Canonical vs provisional with active allocation → block (manual resolution)
 * - Same provisionality / other collisions → classic duplicate skip
 */
export async function resolveLineSupersession(params: {
  tenantId: string
  legalEntityId: string
  lineHash: string
  incomingIsProvisional: boolean
  sourceRowNumber?: number | null
}): Promise<LineSupersessionOutcome> {
  const existing = await prisma.bankStatementLine.findFirst({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      lineHash: params.lineHash,
      isExcluded: false,
      matchStatus: { not: 'EXCLUDED' },
    },
    select: {
      id: true,
      isProvisional: true,
      matchStatus: true,
      matchedAmount: true,
      statementAllocations: {
        where: { reconciliationMatch: { matchStatus: 'ACTIVE' } },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!existing) {
    return { action: 'CREATE', isProvisional: params.incomingIsProvisional }
  }

  const hasActiveMatch =
    existing.statementAllocations.length > 0 ||
    existing.matchStatus === 'MATCHED' ||
    existing.matchStatus === 'PARTIALLY_MATCHED' ||
    existing.matchStatus === 'RECONCILED' ||
    Number(existing.matchedAmount) > 0

  // Incoming provisional, existing canonical → keep evidence as excluded+superseded
  if (params.incomingIsProvisional && !existing.isProvisional) {
    return {
      action: 'CREATE_EXCLUDED',
      isProvisional: true,
      supersededByLineId: existing.id,
    }
  }

  // Incoming canonical, existing provisional
  if (!params.incomingIsProvisional && existing.isProvisional) {
    if (hasActiveMatch) {
      return {
        action: 'BLOCK_ACTIVE_MATCH',
        provisionalLineId: existing.id,
        issue: {
          rowNumber: params.sourceRowNumber ?? undefined,
          severity: 'BLOCKER',
          category: 'DUPLICATE_LINE',
          code: 'BANK_STATEMENT_PROVISIONAL_MATCHED_SUPERSESSION_BLOCKED',
          message:
            'A provisional CAMT.052/054 line with the same identity is already matched in reconciliation. Unmatch it before importing the CAMT.053 statement line.',
        },
      }
    }
    return {
      action: 'CREATE_AND_SUPERSEDE',
      isProvisional: false,
      provisionalLineId: existing.id,
    }
  }

  return { action: 'SKIP_DUPLICATE' }
}

export async function markProvisionalLineSuperseded(params: {
  provisionalLineId: string
  canonicalLineId: string
}): Promise<void> {
  await prisma.bankStatementLine.update({
    where: { id: params.provisionalLineId },
    data: {
      isExcluded: true,
      matchStatus: 'EXCLUDED',
      supersededByLineId: params.canonicalLineId,
    },
  })
}
