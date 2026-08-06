/**
 * Pure purchase-order GST helpers — IGST vs CGST+SGST split and line amounts.
 * Used by API mappers and editor; unit-tested without UI.
 */

export type PurchasePoLineTaxInput = {
  amount: number
  gstRatePct?: number | null
  cgstRate?: number | null
  sgstRate?: number | null
  igstRate?: number | null
  gstScheme?: string | null
}

export type PurchasePoLineTaxAmounts = {
  gstRatePct: number
  taxAmount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  lineTotal: number
  isInterstate: boolean
  gstScheme: 'igst' | 'cgst_sgst'
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Resolve effective GST % and component amounts for a PO line from snapshot rates.
 * Master rates often store CGST+SGST and IGST together — scheme / interstate zeros unused legs.
 */
export function computePurchasePoLineTax(input: PurchasePoLineTaxInput): PurchasePoLineTaxAmounts {
  const taxableAmount = r2(Math.max(0, Number(input.amount) || 0))
  const cgstRate = Math.max(0, Number(input.cgstRate) || 0)
  const sgstRate = Math.max(0, Number(input.sgstRate) || 0)
  const igstRate = Math.max(0, Number(input.igstRate) || 0)
  const schemeRaw = (input.gstScheme ?? '').toLowerCase().replace(/-/g, '_')
  const combinedIntra = cgstRate + sgstRate
  const effectiveIgst = igstRate > 0 ? igstRate : combinedIntra

  const isInterstate =
    schemeRaw === 'igst' ||
    (igstRate > 0 && cgstRate === 0 && sgstRate === 0 && effectiveIgst > 0)

  const gstRatePct =
    Number(input.gstRatePct) > 0
      ? Number(input.gstRatePct)
      : isInterstate
        ? effectiveIgst
        : combinedIntra > 0
          ? combinedIntra
          : effectiveIgst

  const taxAmount = r2((taxableAmount * gstRatePct) / 100)
  const half = r2(taxAmount / 2)

  if (isInterstate) {
    return {
      gstRatePct,
      taxAmount,
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: taxAmount,
      lineTotal: r2(taxableAmount + taxAmount),
      isInterstate: true,
      gstScheme: 'igst',
    }
  }

  return {
    gstRatePct,
    taxAmount,
    taxableAmount,
    cgst: half,
    sgst: half,
    igst: 0,
    lineTotal: r2(taxableAmount + taxAmount),
    isInterstate: false,
    gstScheme: 'cgst_sgst',
  }
}

/** Aggregate header CGST/SGST/IGST from computed line tax rows. */
export function aggregatePurchasePoGstTotals(
  lines: Array<Pick<PurchasePoLineTaxAmounts, 'cgst' | 'sgst' | 'igst'>>,
  isInterstate?: boolean,
): { cgst: number; sgst: number; igst: number; taxAmount: number; gstScheme: 'igst' | 'cgst_sgst' } {
  const cgst = r2(lines.reduce((s, l) => s + (Number(l.cgst) || 0), 0))
  const sgst = r2(lines.reduce((s, l) => s + (Number(l.sgst) || 0), 0))
  const igst = r2(lines.reduce((s, l) => s + (Number(l.igst) || 0), 0))
  const taxAmount = r2(cgst + sgst + igst)
  const scheme: 'igst' | 'cgst_sgst' =
    isInterstate === true || (igst > 0 && cgst === 0 && sgst === 0) ? 'igst' : 'cgst_sgst'
  return { cgst, sgst, igst, taxAmount, gstScheme: scheme }
}

export type PurchaseGstColumnVisibility = {
  showCgst: boolean
  showSgst: boolean
  showIgst: boolean
}

type PurchaseGstColumnLine = {
  cgst?: number | null
  sgst?: number | null
  igst?: number | null
}

/** Show CGST/SGST/IGST columns only when that component has a non-zero amount on the document. */
export function resolvePurchaseGstColumnVisibility(
  lines: PurchaseGstColumnLine[],
  header?: PurchaseGstColumnLine,
): PurchaseGstColumnVisibility {
  const sum = (key: 'cgst' | 'sgst' | 'igst') =>
    r2(
      lines.reduce((s, l) => s + (Number(l[key]) || 0), 0) + (Number(header?.[key]) || 0),
    )
  const cgst = sum('cgst')
  const sgst = sum('sgst')
  const igst = sum('igst')
  return {
    showCgst: cgst > 0,
    showSgst: sgst > 0,
    showIgst: igst > 0,
  }
}
