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

/** True when productRequirement holds the structured lead-lines payload (not human notes). */
export function isEncodedLeadRequirementPayload(raw: string | null | undefined): boolean {
  return String(raw ?? '').trimStart().startsWith(LEAD_REQUIREMENT_LINES_PREFIX)
}

/**
 * Raw productRequirement for the product grid.
 * Plain text that duplicates remarks was incorrectly persisted as product lines — ignore those.
 */
export function resolveLeadRequirementLinesRaw(
  productRequirement: string | null | undefined,
  remarks?: string | null,
): string {
  const raw = String(productRequirement ?? '')
  if (!raw.trim()) return ''
  if (isEncodedLeadRequirementPayload(raw)) return raw
  const notes = String(remarks ?? '').trim()
  if (notes && raw.trim() === notes) return ''
  return raw
}

export function decodeLeadRequirementLines(
  raw: string,
  expectedQty?: number | null,
  remarks?: string | null,
): { lines: OpportunityLine[]; plainText: string } {
  const text = resolveLeadRequirementLinesRaw(raw, remarks)
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

export function leadRequirementDisplayText(
  raw: string,
  expectedQty?: number | null,
  remarks?: string | null,
): string {
  return decodeLeadRequirementLines(raw, expectedQty, remarks).plainText
}

/**
 * Scope Notes for opportunities must stay human-readable.
 * Encoded lead line payloads belong in the product grid only — never in the textarea.
 */
export function sanitizeOpportunityScopeNotes(raw: string | null | undefined): string {
  const text = String(raw ?? '')
  if (isEncodedLeadRequirementPayload(text)) return ''
  return text.trim()
}

/** Human label for lists/cards — never the <!--fos-lead-lines--> payload. */
export function opportunityRequirementDisplay(raw: string | null | undefined): string {
  const text = String(raw ?? '')
  if (!text.trim()) return ''
  if (isEncodedLeadRequirementPayload(text)) return leadRequirementDisplayText(text)
  return text.trim()
}
