/**
 * Decode <!--fos-lead-lines:v1--> payloads stored in productRequirement.
 * Matches web CRM leadRequirementLines (mobile-friendly subset).
 */

export const LEAD_REQUIREMENT_LINES_PREFIX = '<!--fos-lead-lines:v1-->'

export type RequirementLine = {
  id?: string
  lineNo?: number
  itemCode?: string | null
  productOrItem?: string | null
  description?: string | null
  qty?: number | null
  unitPrice?: number | null
  taxPct?: number | null
  lineTotal?: number | null
  discountPct?: number | null
  discountAmount?: number | null
  uom?: string | null
}

export function isEncodedLeadRequirementPayload(raw: string | null | undefined): boolean {
  return String(raw ?? '').trimStart().startsWith(LEAD_REQUIREMENT_LINES_PREFIX)
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function lineTotalFallback(line: RequirementLine): number {
  if (line.lineTotal != null && Number.isFinite(Number(line.lineTotal))) {
    return Number(line.lineTotal)
  }
  const qty = asNumber(line.qty, 1)
  const unit = asNumber(line.unitPrice, 0)
  const tax = asNumber(line.taxPct, 0)
  const discPct = asNumber(line.discountPct, 0)
  const discAmt = asNumber(line.discountAmount, 0)
  let base = qty * unit
  if (discPct > 0) base -= (base * discPct) / 100
  if (discAmt > 0) base -= discAmt
  if (base < 0) base = 0
  return base + (base * tax) / 100
}

function normalizeLine(raw: Record<string, unknown>, index: number): RequirementLine {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    lineNo: asNumber(raw.lineNo, index + 1),
    itemCode: raw.itemCode != null ? String(raw.itemCode) : null,
    productOrItem:
      raw.productOrItem != null
        ? String(raw.productOrItem)
        : raw.itemName != null
          ? String(raw.itemName)
          : null,
    description: raw.description != null ? String(raw.description) : null,
    qty: asNumber(raw.qty, 1),
    unitPrice: asNumber(raw.unitPrice, 0),
    taxPct: asNumber(raw.taxPct, 0),
    lineTotal: asNumber(raw.lineTotal, NaN),
    discountPct: asNumber(raw.discountPct, 0),
    discountAmount: asNumber(raw.discountAmount, 0),
    uom: raw.uom != null ? String(raw.uom) : null,
  }
}

export function decodeLeadRequirementLines(
  raw: string | null | undefined,
  expectedQty?: number | null,
  remarks?: string | null,
): { lines: RequirementLine[]; plainText: string } {
  const text = String(raw ?? '')
  const notes = String(remarks ?? '').trim()

  // Ignore accidental duplicate of remarks stored as requirement
  if (!text.trim() || (notes && text.trim() === notes && !isEncodedLeadRequirementPayload(text))) {
    return { lines: [], plainText: notes || '' }
  }

  if (isEncodedLeadRequirementPayload(text)) {
    try {
      const jsonPart = text.trimStart().slice(LEAD_REQUIREMENT_LINES_PREFIX.length)
      const parsed = JSON.parse(jsonPart) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const lines = parsed
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
          .map((row, i) => {
            const line = normalizeLine(row, i)
            const total = lineTotalFallback(line)
            return { ...line, lineTotal: total }
          })
          .filter(
            (l) =>
              Boolean(String(l.productOrItem ?? '').trim() || String(l.description ?? '').trim() || String(l.itemCode ?? '').trim())
              || (asNumber(l.qty) > 0 && asNumber(l.unitPrice) > 0),
          )
        const plainText = lines
          .map((l) => String(l.productOrItem ?? '').trim() || String(l.description ?? '').trim())
          .filter(Boolean)
          .join('; ')
        return { lines, plainText }
      }
    } catch {
      // fall through
    }
  }

  const plain = text.trim()
  if (!plain) return { lines: [], plainText: notes || '' }

  return {
    lines: [
      {
        lineNo: 1,
        productOrItem: plain,
        qty: expectedQty && expectedQty > 0 ? expectedQty : 1,
        unitPrice: 0,
        taxPct: 0,
        lineTotal: 0,
      },
    ],
    plainText: plain,
  }
}

/** Human-readable requirement for cards/lists — never the encoded JSON dump. */
export function leadRequirementDisplayText(
  raw: string | null | undefined,
  expectedQty?: number | null,
  remarks?: string | null,
): string {
  return decodeLeadRequirementLines(raw, expectedQty, remarks).plainText
}

export function opportunityRequirementDisplay(raw: string | null | undefined): string {
  const text = String(raw ?? '')
  if (!text.trim()) return ''
  if (isEncodedLeadRequirementPayload(text)) return leadRequirementDisplayText(text)
  return text.trim()
}
