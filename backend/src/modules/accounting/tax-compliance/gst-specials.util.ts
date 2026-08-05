/**
 * Phase 11 — GST special schemes / special flows (pure helpers, no I/O).
 * Reuses Phase 1 resolve categories + ledger classification — not a second tax engine.
 * Honest readiness: books-side prep only; not portal GSTR sections, not IT Act TDS.
 */

/** Statutory-ish supply classes for gates + ledger visibility. */
export type GstSupplyClass =
  | 'TAXABLE'
  | 'NIL_RATED'
  | 'EXEMPT'
  | 'ZERO_RATED'
  | 'NON_GST'
  | 'REVERSE_CHARGE'
  | 'COMPOSITION'
  | 'UNRESOLVED'

export type GstRegistrationScheme = 'REGULAR' | 'COMPOSITION' | 'SEZ' | 'CASUAL' | 'UNREGISTERED' | 'OTHER'

export type GstWithholdingKind = 'GST_TDS' | 'GST_TCS'

export type ClassifySupplyInput = {
  /** Total GST % after scheme (0 = candidate nil/exempt/zero/non-gst). */
  gstRate: number
  reverseCharge?: boolean
  /** Explicit hint from caller/master (preferred over rate inference when set). */
  taxCategoryHint?: string | null
  /** AR SalesInvoiceTaxTreatment / AP VendorInvoiceTaxTreatment. */
  taxTreatment?: string | null
  /** Seller (outward) or buyer LE registration scheme. */
  registrationScheme?: string | null
  /** Counterparty composition / unregistered flags. */
  partyRegistrationScheme?: string | null
}

export type ClassifySupplyResult = {
  supplyClass: GstSupplyClass
  isZeroTaxVisible: boolean
  outputTaxPayable: boolean
  itcClaimableDefault: boolean | null
  warnings: string[]
  blockers: string[]
}

const ZERO_TAX_TREATMENTS = new Set([
  'EXPORT_WITHOUT_TAX',
  'SEZ_WITHOUT_TAX',
  'NON_GST',
  'EXEMPT',
  'NIL_RATED',
])

export function normalizeRegistrationScheme(raw: string | null | undefined): GstRegistrationScheme {
  const s = (raw ?? 'REGULAR').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (s === 'COMPOSITION' || s === 'COMPOSITE' || s === 'COMPOSITION_SCHEME') return 'COMPOSITION'
  if (s === 'SEZ' || s === 'SEZ_UNIT') return 'SEZ'
  if (s === 'CASUAL' || s === 'CASUAL_TAXABLE') return 'CASUAL'
  if (s === 'UNREGISTERED' || s === 'URD') return 'UNREGISTERED'
  if (s === 'REGULAR' || s === 'NORMAL') return 'REGULAR'
  return 'OTHER'
}

export function isCompositionScheme(raw: string | null | undefined): boolean {
  return normalizeRegistrationScheme(raw) === 'COMPOSITION'
}

/**
 * Classify supply for resolve gates + ledger visibility.
 * Export/SEZ full LUT lifecycle remains Phase 10 — we only label ZERO_RATED when treatment hints say so.
 */
export function classifyGstSupply(input: ClassifySupplyInput): ClassifySupplyResult {
  const warnings: string[] = []
  const blockers: string[] = []
  const rate = Number(input.gstRate)
  const gstRate = Number.isFinite(rate) ? rate : 0
  const reg = normalizeRegistrationScheme(input.registrationScheme)
  const partyReg = normalizeRegistrationScheme(input.partyRegistrationScheme)
  const treatment = (input.taxTreatment ?? '').trim().toUpperCase()
  const hint = (input.taxCategoryHint ?? '').trim().toUpperCase()

  if (reg === 'COMPOSITION') {
    warnings.push('Supplier is under GST composition scheme — output tax & ITC rules differ; e-invoice typically not available')
  }
  if (partyReg === 'COMPOSITION') {
    warnings.push('Counterparty is composition taxpayer — verify purchase constraints')
  }

  if (input.reverseCharge || hint === 'REVERSE_CHARGE' || treatment === 'REVERSE_CHARGE') {
    return {
      supplyClass: 'REVERSE_CHARGE',
      isZeroTaxVisible: false,
      outputTaxPayable: true,
      itcClaimableDefault: null,
      warnings,
      blockers,
    }
  }

  if (reg === 'COMPOSITION' && gstRate > 0) {
    // Composition dealers do not collect normal GST on outward supplies in books the same way.
    warnings.push('Composition registration: normal multi-rate GST components unexpected on outward supply')
  }

  if (hint === 'NON_GST' || treatment === 'NON_GST') {
    return {
      supplyClass: 'NON_GST',
      isZeroTaxVisible: true,
      outputTaxPayable: false,
      itcClaimableDefault: false,
      warnings,
      blockers,
    }
  }

  if (
    hint === 'ZERO_RATED' ||
    treatment === 'EXPORT_WITHOUT_TAX' ||
    treatment === 'SEZ_WITHOUT_TAX'
  ) {
    warnings.push(
      'Zero-rated classification set — LUT/shipping-bill lifecycle is Phase 10 (export/SEZ); this phase only labels the class',
    )
    return {
      supplyClass: 'ZERO_RATED',
      isZeroTaxVisible: true,
      outputTaxPayable: false,
      itcClaimableDefault: null,
      warnings,
      blockers,
    }
  }

  if (hint === 'EXEMPT' || treatment === 'EXEMPT') {
    return {
      supplyClass: 'EXEMPT',
      isZeroTaxVisible: true,
      outputTaxPayable: false,
      itcClaimableDefault: false,
      warnings,
      blockers,
    }
  }

  if (hint === 'NIL_RATED' || treatment === 'NIL_RATED') {
    return {
      supplyClass: 'NIL_RATED',
      isZeroTaxVisible: true,
      outputTaxPayable: false,
      itcClaimableDefault: false,
      warnings,
      blockers,
    }
  }

  if (hint === 'UNRESOLVED') {
    blockers.push('Tax category unresolved — cannot post special nil/exempt classification')
    return {
      supplyClass: 'UNRESOLVED',
      isZeroTaxVisible: false,
      outputTaxPayable: false,
      itcClaimableDefault: null,
      warnings,
      blockers,
    }
  }

  if (gstRate === 0) {
    // Ambiguous 0% without explicit class — default NIL_RATED with honest warning.
    warnings.push(
      'GST rate is 0% without explicit EXEMPT/ZERO_RATED/NON_GST hint — classified as NIL_RATED (set taxCategoryHint to disambiguate)',
    )
    return {
      supplyClass: 'NIL_RATED',
      isZeroTaxVisible: true,
      outputTaxPayable: false,
      itcClaimableDefault: false,
      warnings,
      blockers,
    }
  }

  if (ZERO_TAX_TREATMENTS.has(treatment) && gstRate > 0) {
    blockers.push(`Treatment ${treatment} expects zero tax but rate is ${gstRate}%`)
  }

  if (reg === 'COMPOSITION') {
    return {
      supplyClass: 'COMPOSITION',
      isZeroTaxVisible: gstRate === 0,
      outputTaxPayable: false,
      itcClaimableDefault: false,
      warnings,
      blockers,
    }
  }

  return {
    supplyClass: 'TAXABLE',
    isZeroTaxVisible: false,
    outputTaxPayable: true,
    itcClaimableDefault: true,
    warnings,
    blockers,
  }
}

export type CompositionFeatureGateResult =
  | { allowed: true; flags: string[] }
  | { allowed: false; code: string; message: string; flags: string[] }

/** Composition dealers generally cannot generate e-invoices (B2B IRN). */
export function assertCompositionAllowsEInvoice(opts: {
  sellerRegistrationScheme?: string | null
  featureFlagEnabled?: boolean
}): CompositionFeatureGateResult {
  const flags: string[] = []
  if (opts.featureFlagEnabled === false) {
    flags.push('GST_PHASE11_SPECIALS_DISABLED')
  }
  if (isCompositionScheme(opts.sellerRegistrationScheme)) {
    return {
      allowed: false,
      code: 'COMPOSITION_EINVOICE',
      message:
        'Composition scheme registration cannot generate e-invoice IRN (Phase 11 gate). Switch LE/registration to REGULAR or use non-composition GSTIN.',
      flags: [...flags, 'COMPOSITION'],
    }
  }
  return { allowed: true, flags }
}

/** Soft gate: e-way still possible for goods movement, but flag composition. */
export function compositionEwayNotes(sellerRegistrationScheme?: string | null): string[] {
  if (!isCompositionScheme(sellerRegistrationScheme)) return []
  return [
    'Composition taxpayer: e-way may still apply for goods movement — verify eligibility; product does not auto-file portal e-way',
  ]
}

export type JobWorkMovement = 'DISPATCH_TO_JOBWORKER' | 'RETURN_FROM_JOBWORKER' | 'JOBWORK_INVOICE'

export type JobWorkGstEval = {
  movement: JobWorkMovement
  gstOnProcessChargesOnly: boolean
  materialsInEwayScope: boolean
  warnings: string[]
  notes: string[]
}

/**
 * Job-work GST boundary notes — manufacturing ops remain source of truth;
 * this does not invent WO/JW tax engine.
 */
export function evaluateJobWorkGstTreatment(input: {
  movement: JobWorkMovement
  processCharges?: number
  materialsTaxableValue?: number
}): JobWorkGstEval {
  const warnings: string[] = []
  const notes: string[] = []
  switch (input.movement) {
    case 'DISPATCH_TO_JOBWORKER':
      notes.push('Outbound job-work material send is typically not a taxable supply of goods (challan context)')
      return {
        movement: input.movement,
        gstOnProcessChargesOnly: false,
        materialsInEwayScope: true,
        warnings,
        notes,
      }
    case 'RETURN_FROM_JOBWORKER':
      notes.push('Return of processed goods — match against original job-work challan / PO')
      return {
        movement: input.movement,
        gstOnProcessChargesOnly: false,
        materialsInEwayScope: true,
        warnings,
        notes,
      }
    case 'JOBWORK_INVOICE': {
      const charges = Number(input.processCharges ?? 0)
      if (!(charges > 0)) {
        warnings.push('Job-work invoice process charges are zero — verify taxable service value')
      }
      notes.push('GST (if any) typically applies on process charges via normal tax resolve + vendor invoice — not a separate engine')
      return {
        movement: input.movement,
        gstOnProcessChargesOnly: true,
        materialsInEwayScope: false,
        warnings,
        notes,
      }
    }
  }
}

/** GST TDS Sec 51 default rate (1% CGST + 1% SGST or 2% IGST) — books prep only. */
export function computeGstTdsLiability(opts: {
  kind: GstWithholdingKind
  taxableValue: number
  isInterstate: boolean
  /** Override total % (default 2 for GST_TDS, 1 for GST_TCS ecommerce-style). */
  ratePct?: number
}): {
  taxableValue: number
  ratePct: number
  tdsCgst: number
  tdsSgst: number
  tdsIgst: number
  totalWithheld: number
} {
  const taxable = Math.max(0, Number(opts.taxableValue) || 0)
  const defaultRate = opts.kind === 'GST_TCS' ? 1 : 2
  const ratePct = opts.ratePct != null && Number.isFinite(opts.ratePct) ? Number(opts.ratePct) : defaultRate
  const total = Math.round((taxable * ratePct) / 100 * 100) / 100
  if (opts.isInterstate) {
    return {
      taxableValue: taxable,
      ratePct,
      tdsCgst: 0,
      tdsSgst: 0,
      tdsIgst: total,
      totalWithheld: total,
    }
  }
  const half = Math.round((total / 2) * 100) / 100
  const cgst = half
  const sgst = Math.round((total - half) * 100) / 100
  return {
    taxableValue: taxable,
    ratePct,
    tdsCgst: cgst,
    tdsSgst: sgst,
    tdsIgst: 0,
    totalWithheld: Math.round((cgst + sgst) * 100) / 100,
  }
}

export type AdvanceAdjustInput = {
  advanceTaxable: number
  advanceTax: number
  invoiceTaxable: number
  invoiceTax: number
  alreadyAdjustedTaxable?: number
  alreadyAdjustedTax?: number
}

export type AdvanceAdjustResult = {
  adjustableTaxable: number
  adjustableTax: number
  remainingAdvanceTaxable: number
  remainingAdvanceTax: number
  fullyAdjusted: boolean
  warnings: string[]
}

/** Allocate advance against invoice for Table-11 style prep (not full GSTR-1 engine). */
export function allocateAdvanceAgainstInvoice(input: AdvanceAdjustInput): AdvanceAdjustResult {
  const warnings: string[] = []
  const usedTaxable = Math.max(0, Number(input.alreadyAdjustedTaxable) || 0)
  const usedTax = Math.max(0, Number(input.alreadyAdjustedTax) || 0)
  const remTaxable = Math.max(0, Number(input.advanceTaxable) - usedTaxable)
  const remTax = Math.max(0, Number(input.advanceTax) - usedTax)
  const invTaxable = Math.max(0, Number(input.invoiceTaxable) || 0)
  const invTax = Math.max(0, Number(input.invoiceTax) || 0)

  const adjustableTaxable = Math.min(remTaxable, invTaxable)
  // Proportional tax when invoice tax exists; else drain remaining advance tax by ratio.
  let adjustableTax = 0
  if (invTaxable > 0 && remTaxable > 0) {
    const ratio = adjustableTaxable / remTaxable
    adjustableTax = Math.min(remTax, Math.round(remTax * ratio * 100) / 100)
    if (invTax > 0) {
      adjustableTax = Math.min(adjustableTax, invTax, remTax)
    }
  } else {
    adjustableTax = Math.min(remTax, invTax)
  }

  if (adjustableTaxable === 0 && remTaxable > 0) {
    warnings.push('No taxable value left on invoice to adjust against this advance')
  }

  const remainingAdvanceTaxable = Math.round((remTaxable - adjustableTaxable) * 100) / 100
  const remainingAdvanceTax = Math.round((remTax - adjustableTax) * 100) / 100
  return {
    adjustableTaxable: Math.round(adjustableTaxable * 100) / 100,
    adjustableTax: Math.round(adjustableTax * 100) / 100,
    remainingAdvanceTaxable,
    remainingAdvanceTax,
    fullyAdjusted: remainingAdvanceTaxable <= 0.005 && remainingAdvanceTax <= 0.005,
    warnings,
  }
}

export type SpecialCapability = {
  id: string
  label: string
  status: 'READY' | 'PARTIAL' | 'DEFERRED' | 'NOT_IN_SCOPE'
  notes: string
}

/** Honest capability matrix for Phase 11 — never labels portal-ready / FULL GST COMPLIANT. */
export function buildPhase11CapabilityMatrix(): {
  phase: 11
  verdict: 'READY_WITH_CONDITIONS'
  notFullGstCompliant: true
  capabilities: SpecialCapability[]
} {
  return {
    phase: 11,
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true,
    capabilities: [
      {
        id: 'nil_exempt_nongst_classify',
        label: 'Nil-rated / exempt / non-GST / zero-rated classification gates',
        status: 'READY',
        notes: 'Via classifyGstSupply + tax resolve taxCategoryHint; ledger supplyClass + zero-tax rows',
      },
      {
        id: 'composition_gates',
        label: 'Composition registration feature gates',
        status: 'READY',
        notes: 'Blocks e-invoice IRN for COMPOSITION registrationType; flags on resolve',
      },
      {
        id: 'gst_tds_tcs_books',
        label: 'GST TDS/TCS (Sec 51/52 style) books register',
        status: 'PARTIAL',
        notes: 'Manual liability prep + mark paid; not portal GSTR-7/8 filing; not Income-tax TDS engine',
      },
      {
        id: 'advances',
        label: 'Customer advance adjustment register',
        status: 'PARTIAL',
        notes: 'Books-side advance → invoice allocate; not full GSTR-1 Table 11 engine',
      },
      {
        id: 'job_work',
        label: 'Job-work GST evaluation',
        status: 'PARTIAL',
        notes: 'Boundary notes + eval util; manufacturing JobWorkOrder remains SoT',
      },
      {
        id: 'export_lut_sez',
        label: 'Export / SEZ / LUT lifecycle',
        status: 'PARTIAL',
        notes: 'Owned by Phase 10 — Phase 11 co-labels ZERO_RATED only; see PHASE10_EXPORT_SEZ_LUT',
      },
      {
        id: 'portal_filing',
        label: 'GST portal filing / GSTR submit',
        status: 'PARTIAL',
        notes:
          'Phase 12 foundation: package from locked GSTR-1/3B + SIMULATED submit + ARN/mark-filed. LIVE hard-gated (not certified). Not FULL GST COMPLIANT.',
      },
      {
        id: 'it_tds_act2025',
        label: 'Income-tax TDS/TCS Act 2025 engine',
        status: 'NOT_IN_SCOPE',
        notes: 'Parallel TDS track — do not mix into GST resolve',
      },
    ],
  }
}

export function isPhase11SpecialsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.GST_PHASE11_SPECIALS_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

export function isNilExemptOrNonGstClass(c: GstSupplyClass): boolean {
  return c === 'NIL_RATED' || c === 'EXEMPT' || c === 'NON_GST' || c === 'ZERO_RATED'
}
