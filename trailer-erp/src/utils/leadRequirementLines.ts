import type { OpportunityLine } from '../types/crm'
import {
  calcOpportunityLinesSummary,
  createEmptyOpportunityLine,
  syncOpportunityLines,
} from './opportunityLineCalc'

/** Persist structured lead requirement lines inside productRequirement (TEXT) without a schema migration. */
export const LEAD_REQUIREMENT_LINES_PREFIX = '<!--fos-lead-lines:v1-->'

export function summarizeLeadRequirementLines(lines: OpportunityLine[]): string {
  return syncOpportunityLines(lines)
    .map((l) => l.productOrItem.trim() || l.description.trim())
    .filter(Boolean)
    .join('; ')
}

export function hasLeadRequirementLines(lines: OpportunityLine[]): boolean {
  return syncOpportunityLines(lines).some(
    (l) => Boolean(l.productId || l.productOrItem.trim() || l.description.trim() || (l.qty > 0 && l.unitPrice > 0)),
  )
}

export function decodeLeadRequirementLines(
  raw: string,
  expectedQty?: number | null,
): { lines: OpportunityLine[]; plainText: string } {
  const text = String(raw ?? '')
  if (text.startsWith(LEAD_REQUIREMENT_LINES_PREFIX)) {
    try {
      const parsed = JSON.parse(text.slice(LEAD_REQUIREMENT_LINES_PREFIX.length)) as OpportunityLine[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const lines = syncOpportunityLines(parsed)
        return { lines, plainText: summarizeLeadRequirementLines(lines) }
      }
    } catch {
      // fall through to plain-text handling
    }
  }

  const plain = text.trim()
  if (!plain) {
    return { lines: [createEmptyOpportunityLine(1)], plainText: '' }
  }

  return {
    lines: syncOpportunityLines([
      createEmptyOpportunityLine(1, {
        productOrItem: plain,
        qty: expectedQty && expectedQty > 0 ? expectedQty : 1,
      }),
    ]),
    plainText: plain,
  }
}

export function encodeLeadRequirementLines(lines: OpportunityLine[]): string {
  const synced = syncOpportunityLines(lines)
  if (!hasLeadRequirementLines(synced)) return ''
  return `${LEAD_REQUIREMENT_LINES_PREFIX}${JSON.stringify(synced)}`
}

export function leadRequirementQtyTotal(lines: OpportunityLine[]): number {
  return calcOpportunityLinesSummary(lines).totalQty
}

export function leadRequirementDisplayText(raw: string, expectedQty?: number | null): string {
  return decodeLeadRequirementLines(raw, expectedQty).plainText
}
