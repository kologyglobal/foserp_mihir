import type { GstBreakdown, GstScheme } from '../types/invoice'
import { COMPANY_STATE, DEFAULT_GST_RATE } from '../types/invoice'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Intra-state → CGST+SGST; inter-state → IGST */
export function resolveGstScheme(customerState: string): GstScheme {
  return customerState.trim().toLowerCase() === COMPANY_STATE.toLowerCase() ? 'cgst_sgst' : 'igst'
}

export function computeGst(
  taxableAmount: number,
  customerState: string,
  gstRate: number = DEFAULT_GST_RATE,
): GstBreakdown {
  const scheme = resolveGstScheme(customerState)
  const totalTax = round2(taxableAmount * (gstRate / 100))

  if (scheme === 'cgst_sgst') {
    const halfRate = gstRate / 2
    const halfTax = round2(totalTax / 2)
    return {
      scheme,
      taxableAmount: round2(taxableAmount),
      cgstRate: halfRate,
      cgstAmount: halfTax,
      sgstRate: halfRate,
      sgstAmount: halfTax,
      igstRate: 0,
      igstAmount: 0,
      totalTax,
      grandTotal: round2(taxableAmount + totalTax),
    }
  }

  return {
    scheme,
    taxableAmount: round2(taxableAmount),
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: gstRate,
    igstAmount: totalTax,
    totalTax,
    grandTotal: round2(taxableAmount + totalTax),
  }
}

export function gstStateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2)
}

export function gstSchemeLabel(scheme: GstScheme): string {
  return scheme === 'cgst_sgst' ? 'CGST + SGST (Intra-state)' : 'IGST (Inter-state)'
}
