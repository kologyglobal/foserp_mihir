import type { GstBreakdown, GstScheme } from '../types/invoice'
import { COMPANY_STATE, DEFAULT_GST_RATE } from '../types/invoice'
import { isApiMode } from '../config/apiConfig'
import {
  resolveGstTaxFromMasters,
  type ResolveGstTaxParams,
} from '../services/accounting/taxResolutionApi'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Intra-state → CGST+SGST; inter-state → IGST */
export function resolveGstScheme(customerState: string): GstScheme {
  return customerState.trim().toLowerCase() === COMPANY_STATE.toLowerCase() ? 'cgst_sgst' : 'igst'
}

/**
 * Demo-only local GST split. In API mode prefer {@link computeGstFromTaxMaster}
 * or AR/AP calculate endpoints — do not hardcode rates in forms.
 */
export function computeGst(
  taxableAmount: number,
  customerState: string,
  gstRate: number = DEFAULT_GST_RATE,
): GstBreakdown {
  if (isApiMode()) {
    console.warn(
      '[gstEngine] computeGst is demo-local; use computeGstFromTaxMaster or finance calculate APIs in API mode.',
    )
  }
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

/** Build breakdown from master-resolved CGST/SGST/IGST component rates. */
export function breakdownFromMasterRates(
  taxableAmount: number,
  rates: { cgstRate: number; sgstRate: number; igstRate: number },
): GstBreakdown {
  const taxable = round2(taxableAmount)
  const cgstAmount = round2(taxable * (rates.cgstRate / 100))
  const sgstAmount = round2(taxable * (rates.sgstRate / 100))
  const igstAmount = round2(taxable * (rates.igstRate / 100))
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount)
  const scheme: GstScheme = igstAmount > 0 && cgstAmount + sgstAmount === 0 ? 'igst' : 'cgst_sgst'
  return {
    scheme,
    taxableAmount: taxable,
    cgstRate: rates.cgstRate,
    cgstAmount,
    sgstRate: rates.sgstRate,
    sgstAmount,
    igstRate: rates.igstRate,
    igstAmount,
    totalTax,
    grandTotal: round2(taxable + totalTax),
  }
}

/**
 * API-mode tax calculation: rates from tax master (HSN / group / states / effective date / S|P).
 * Returns null when master has no matching rate — forms should block or warn, not invent %.
 */
export async function computeGstFromTaxMaster(
  taxableAmount: number,
  params: ResolveGstTaxParams,
): Promise<GstBreakdown | null> {
  const resolved = await resolveGstTaxFromMasters(params)
  if (!resolved) return null
  return breakdownFromMasterRates(taxableAmount, {
    cgstRate: Number(resolved.cgstRate),
    sgstRate: Number(resolved.sgstRate),
    igstRate: Number(resolved.igstRate),
  })
}

export function gstStateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2)
}

export function gstSchemeLabel(scheme: GstScheme): string {
  return scheme === 'cgst_sgst' ? 'CGST + SGST (Intra-state)' : 'IGST (Inter-state)'
}
