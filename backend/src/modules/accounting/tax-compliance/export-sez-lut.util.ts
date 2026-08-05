/**
 * Phase 10 — pure Export / SEZ / LUT classification helpers.
 * No I/O. Used by tax resolve, SI validation, GST ledger snapshots, GSTR-1 export section.
 */

/** Commercial tax treatments for zero-rated sales (AR). */
export type ZeroRatedTaxTreatment =
  | 'EXPORT_WITH_TAX'
  | 'EXPORT_WITHOUT_TAX'
  | 'SEZ_WITH_TAX'
  | 'SEZ_WITHOUT_TAX'

/** Payment of IGST on zero-rated supply (portal WPAY / WOPAY style, books labels). */
export type ZeroRatedPaymentMode = 'WPAY' | 'WOPAY'

export type ExportSezClass =
  | 'EXPORT_WPAY'
  | 'EXPORT_WOPAY'
  | 'SEZ_WPAY'
  | 'SEZ_WOPAY'
  | 'DOMESTIC'
  | 'UNKNOWN'

export type LutValidityStatus = 'VALID' | 'EXPIRED' | 'NOT_YET_EFFECTIVE' | 'INACTIVE' | 'GSTIN_MISMATCH' | 'MISSING'

export type LutLike = {
  lutNumber: string
  companyGstin: string | null
  validFrom: string
  validTo: string | null
  isActive: boolean
  status?: string | null
}

const ZERO_RATED_TREATMENTS = new Set<string>([
  'EXPORT_WITH_TAX',
  'EXPORT_WITHOUT_TAX',
  'SEZ_WITH_TAX',
  'SEZ_WITHOUT_TAX',
])

const WITHOUT_PAYMENT = new Set<string>(['EXPORT_WITHOUT_TAX', 'SEZ_WITHOUT_TAX'])
const WITH_PAYMENT = new Set<string>(['EXPORT_WITH_TAX', 'SEZ_WITH_TAX'])

export function isZeroRatedTaxTreatment(taxTreatment: string | null | undefined): boolean {
  return Boolean(taxTreatment && ZERO_RATED_TREATMENTS.has(taxTreatment))
}

export function requiresLutCoverage(taxTreatment: string | null | undefined): boolean {
  return Boolean(taxTreatment && WITHOUT_PAYMENT.has(taxTreatment))
}

export function isExportOrSezTreatment(taxTreatment: string | null | undefined): boolean {
  return isZeroRatedTaxTreatment(taxTreatment)
}

export function paymentModeFromTreatment(
  taxTreatment: string | null | undefined,
): ZeroRatedPaymentMode | null {
  if (!taxTreatment) return null
  if (WITHOUT_PAYMENT.has(taxTreatment)) return 'WOPAY'
  if (WITH_PAYMENT.has(taxTreatment)) return 'WPAY'
  return null
}

export function classifyExportSez(input: {
  taxTreatment?: string | null
  supplyType?: string | null
  placeOfSupply?: string | null
}): ExportSezClass {
  const t = input.taxTreatment?.trim().toUpperCase() || null
  if (t === 'EXPORT_WITH_TAX') return 'EXPORT_WPAY'
  if (t === 'EXPORT_WITHOUT_TAX') return 'EXPORT_WOPAY'
  if (t === 'SEZ_WITH_TAX') return 'SEZ_WPAY'
  if (t === 'SEZ_WITHOUT_TAX') return 'SEZ_WOPAY'

  const supply = input.supplyType?.trim().toUpperCase() || null
  if (supply === 'EXPORT') return 'EXPORT_WPAY' // default unknown payment until treatment set
  if (supply === 'SEZ') return 'SEZ_WPAY'

  if (isExportOrSezPlaceOfSupply(input.placeOfSupply)) {
    return 'UNKNOWN'
  }
  return 'DOMESTIC'
}

/**
 * Place-of-supply heuristics (Phase 5) plus code 96 (outside India / other territory).
 * Prefer taxTreatment / supplyType when stamped on ledger sourceSnapshot.
 */
export function isExportOrSezPlaceOfSupply(placeOfSupply: string | null | undefined): boolean {
  if (!placeOfSupply) return false
  const p = placeOfSupply.toUpperCase().trim()
  return (
    p.includes('EXPORT') ||
    p.includes('SEZ') ||
    p.includes('OUTSIDE INDIA') ||
    p === '96' ||
    p.startsWith('96-') ||
    p === '97' ||
    p.startsWith('97-')
  )
}

/** Document is export/SEZ if treatment, supply type, or POS says so. */
export function isExportOrSezDocument(input: {
  taxTreatment?: string | null
  supplyType?: string | null
  placeOfSupply?: string | null
}): boolean {
  const cls = classifyExportSez(input)
  return cls !== 'DOMESTIC'
}

/**
 * Apply zero-rated commercial treatment onto resolved master rates.
 * WPAY → full IGST lane at master rate; WOPAY → all rates zero; category ZERO_RATED.
 */
export function applyZeroRatedTreatmentToRates(input: {
  taxTreatment: string | null | undefined
  cgstRate: number
  sgstRate: number
  utgstRate: number
  igstRate: number
  gstRate: number
}): {
  applied: boolean
  taxCategory: 'ZERO_RATED' | 'TAXABLE' | 'UNCHANGED'
  taxScheme: 'igst' | 'unchanged'
  cgstRate: number
  sgstRate: number
  utgstRate: number
  igstRate: number
  gstRate: number
  paymentMode: ZeroRatedPaymentMode | null
  warnings: string[]
  blockers: string[]
} {
  const warnings: string[] = []
  const blockers: string[] = []
  const treatment = input.taxTreatment?.trim() || null

  if (!treatment || !isZeroRatedTaxTreatment(treatment)) {
    return {
      applied: false,
      taxCategory: 'UNCHANGED',
      taxScheme: 'unchanged',
      cgstRate: input.cgstRate,
      sgstRate: input.sgstRate,
      utgstRate: input.utgstRate,
      igstRate: input.igstRate,
      gstRate: input.gstRate,
      paymentMode: null,
      warnings,
      blockers,
    }
  }

  const paymentMode = paymentModeFromTreatment(treatment)!
  const masterIgst =
    input.igstRate > 0 ? input.igstRate : input.gstRate > 0 ? input.gstRate : input.cgstRate + input.sgstRate

  if (paymentMode === 'WOPAY') {
    warnings.push(
      `Zero-rated ${treatment}: without payment of IGST (WOPAY) — rates forced to 0%; valid LUT required on books`,
    )
    return {
      applied: true,
      taxCategory: 'ZERO_RATED',
      taxScheme: 'igst',
      cgstRate: 0,
      sgstRate: 0,
      utgstRate: 0,
      igstRate: 0,
      gstRate: 0,
      paymentMode,
      warnings,
      blockers,
    }
  }

  // WPAY — with payment of IGST
  warnings.push(`Zero-rated ${treatment}: with payment of IGST (WPAY) — IGST lane only`)
  return {
    applied: true,
    taxCategory: 'ZERO_RATED',
    taxScheme: 'igst',
    cgstRate: 0,
    sgstRate: 0,
    utgstRate: 0,
    igstRate: masterIgst,
    gstRate: masterIgst,
    paymentMode,
    warnings,
    blockers,
  }
}

function parseDateOnly(value: string): Date {
  const s = value.slice(0, 10)
  return new Date(`${s}T00:00:00.000Z`)
}

export function evaluateLutValidity(
  lut: LutLike | null | undefined,
  opts: { asOfDate: string; companyGstin?: string | null },
): { status: LutValidityStatus; ok: boolean; message: string } {
  if (!lut) {
    return { status: 'MISSING', ok: false, message: 'No LUT on file' }
  }
  if (lut.isActive === false || (lut.status && lut.status !== 'ACTIVE')) {
    return { status: 'INACTIVE', ok: false, message: `LUT ${lut.lutNumber} is not active` }
  }
  const asOf = parseDateOnly(opts.asOfDate)
  const from = parseDateOnly(lut.validFrom)
  if (asOf < from) {
    return {
      status: 'NOT_YET_EFFECTIVE',
      ok: false,
      message: `LUT ${lut.lutNumber} effective from ${lut.validFrom}`,
    }
  }
  if (lut.validTo) {
    const to = parseDateOnly(lut.validTo)
    if (asOf > to) {
      return { status: 'EXPIRED', ok: false, message: `LUT ${lut.lutNumber} expired on ${lut.validTo}` }
    }
  }
  const want = opts.companyGstin?.trim().toUpperCase() || null
  const have = lut.companyGstin?.trim().toUpperCase() || null
  if (want && have && want !== have) {
    return {
      status: 'GSTIN_MISMATCH',
      ok: false,
      message: `LUT GSTIN ${have} does not match company GSTIN ${want}`,
    }
  }
  return { status: 'VALID', ok: true, message: `LUT ${lut.lutNumber} valid on ${opts.asOfDate.slice(0, 10)}` }
}

/**
 * Gate for without-payment zero-rated supplies.
 * Soft mode yields warnings only; hard mode adds blockers.
 */
export function assessLutRequirement(input: {
  taxTreatment: string | null | undefined
  lut: LutLike | null | undefined
  asOfDate: string
  companyGstin?: string | null
  /** When true, missing/invalid LUT is a blocker (post-ready). Default soft = warning. */
  hardBlock?: boolean
}): { required: boolean; warnings: string[]; blockers: string[]; lutStatus: LutValidityStatus } {
  const warnings: string[] = []
  const blockers: string[] = []
  if (!requiresLutCoverage(input.taxTreatment)) {
    return { required: false, warnings, blockers, lutStatus: 'MISSING' }
  }
  const eval_ = evaluateLutValidity(input.lut, {
    asOfDate: input.asOfDate,
    companyGstin: input.companyGstin,
  })
  if (eval_.ok) {
    warnings.push(eval_.message)
    return { required: true, warnings, blockers, lutStatus: eval_.status }
  }
  const msg = `LUT required for ${input.taxTreatment}: ${eval_.message}`
  if (input.hardBlock) blockers.push(msg)
  else warnings.push(msg)
  return { required: true, warnings, blockers, lutStatus: eval_.status }
}

export type ExportRefundFoundationRow = {
  claimType: 'IGST_REFUND' | 'ITC_REFUND' | 'OTHER'
  returnPeriod: string
  taxableValue: number
  igstAmount: number
  status: 'DRAFT' | 'PREPARED' | 'SUBMITTED_EXTERNAL' | 'VOID'
}

/** Books-only refund claim draft from export WPAY rows (not portal RFD). */
export function proposeIgstRefundFromExport(input: {
  returnPeriod: string
  exportWpayTaxable: number
  exportWpayIgst: number
}): ExportRefundFoundationRow | null {
  if (input.exportWpayIgst <= 0 && input.exportWpayTaxable <= 0) return null
  return {
    claimType: 'IGST_REFUND',
    returnPeriod: input.returnPeriod,
    taxableValue: Math.round((input.exportWpayTaxable + Number.EPSILON) * 100) / 100,
    igstAmount: Math.round((input.exportWpayIgst + Number.EPSILON) * 100) / 100,
    status: 'DRAFT',
  }
}

/** Split GSTR-1 export section rows by WPAY/WOPAY from classification. */
export function partitionExportSezDocs<T extends { taxTreatment?: string | null; supplyType?: string | null; placeOfSupply?: string | null; totalTax?: number }>(
  docs: T[],
): { wpay: T[]; wopay: T[]; other: T[] } {
  const wpay: T[] = []
  const wopay: T[] = []
  const other: T[] = []
  for (const d of docs) {
    const mode = paymentModeFromTreatment(d.taxTreatment)
    if (mode === 'WPAY') wpay.push(d)
    else if (mode === 'WOPAY') wopay.push(d)
    else if (isExportOrSezDocument(d)) other.push(d)
  }
  return { wpay, wopay, other }
}
