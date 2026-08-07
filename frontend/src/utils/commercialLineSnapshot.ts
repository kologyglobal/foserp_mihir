/**
 * Shared commercial line tax snapshot helpers (HSN/SAC + scheme).
 * Read order for HSN: line snapshot → item master → empty.
 * Reuses LineTaxSnapshot from resolveCommercialLineTax — no second engine.
 */
import type { LineTaxSnapshot } from './commercialLineTax'
import type { GstScheme } from '../types/invoice'

export type CommercialLineTaxFields = {
  hsnCode?: string | null
  hsnId?: string | null
  taxScheme?: GstScheme | 'cgst_sgst' | 'igst' | 'utgst_pair' | string | null
  cgstRate?: number | null
  sgstRate?: number | null
  utgstRate?: number | null
  igstRate?: number | null
  cessRate?: number | null
  cgstAmount?: number | null
  sgstAmount?: number | null
  utgstAmount?: number | null
  igstAmount?: number | null
  taxPct?: number | null
  taxableValue?: number | null
  gstAmount?: number | null
}

/** Display HSN/SAC: preferred line snapshot, then master fallback. */
export function resolveHsnSacDisplay(
  line: { hsnCode?: string | null; sacCode?: string | null } | null | undefined,
  item?: { hsnCode?: string | null } | null,
): { code: string; fromSnapshot: boolean; missing: boolean } {
  const snap = (line?.hsnCode ?? line?.sacCode ?? '').trim()
  if (snap) return { code: snap, fromSnapshot: true, missing: false }
  const master = (item?.hsnCode ?? '').trim()
  if (master) return { code: master, fromSnapshot: false, missing: false }
  return { code: '', fromSnapshot: false, missing: true }
}

export function formatTaxSchemeLabel(scheme?: string | null): string {
  const s = (scheme ?? '').toLowerCase()
  if (s === 'igst') return 'IGST'
  if (s === 'utgst_pair' || s === 'cgst_utgst') return 'CGST+UTGST'
  if (s === 'cgst_sgst' || s === 'intra') return 'CGST+SGST'
  if (s === 'unresolved' || !s) return '-'
  return scheme ?? '-'
}

export function taxFieldsFromLineTaxSnapshot(snap: LineTaxSnapshot): CommercialLineTaxFields {
  return {
    hsnCode: snap.hsnSacCode || null,
    taxScheme: snap.taxScheme,
    cgstRate: snap.cgstRate,
    sgstRate: snap.sgstRate,
    igstRate: snap.igstRate,
    cessRate: snap.cessRate,
    taxPct: snap.taxPct,
  }
}

export function breakupAmounts(
  taxable: number,
  fields: Pick<CommercialLineTaxFields, 'taxScheme' | 'cgstRate' | 'sgstRate' | 'igstRate' | 'utgstRate' | 'taxPct'>,
): { cgstAmount: number; sgstAmount: number; utgstAmount: number; igstAmount: number; gstAmount: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const scheme = (fields.taxScheme ?? '').toLowerCase()
  const taxPct = fields.taxPct ?? 0
  if (scheme === 'igst') {
    const rate = fields.igstRate != null && fields.igstRate > 0 ? fields.igstRate : taxPct
    const igstAmount = r2(taxable * (rate / 100))
    return { cgstAmount: 0, sgstAmount: 0, utgstAmount: 0, igstAmount, gstAmount: igstAmount }
  }
  if (scheme === 'utgst_pair' || scheme === 'cgst_utgst') {
    const cgstRate = fields.cgstRate ?? taxPct / 2
    const utgstRate = fields.utgstRate ?? fields.sgstRate ?? taxPct / 2
    const cgstAmount = r2(taxable * (cgstRate / 100))
    const utgstAmount = r2(taxable * (utgstRate / 100))
    return {
      cgstAmount,
      sgstAmount: 0,
      utgstAmount,
      igstAmount: 0,
      gstAmount: r2(cgstAmount + utgstAmount),
    }
  }
  // Default CGST+SGST (and when rates missing, split taxPct)
  const cgstRate = fields.cgstRate != null && fields.cgstRate > 0 ? fields.cgstRate : taxPct / 2
  const sgstRate = fields.sgstRate != null && fields.sgstRate > 0 ? fields.sgstRate : taxPct / 2
  const cgstAmount = r2(taxable * (cgstRate / 100))
  const sgstAmount = r2(taxable * (sgstRate / 100))
  return {
    cgstAmount,
    sgstAmount,
    utgstAmount: 0,
    igstAmount: 0,
    gstAmount: r2(cgstAmount + sgstAmount),
  }
}
