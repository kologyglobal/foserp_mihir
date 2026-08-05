/**
 * Phase 1 — Central GST determination facade over master tax resolvers.
 * Documents must call this (or AR/AP calculate) — never invent 18%.
 */
import { prisma } from '../../config/prisma.js'
import {
  resolveHsnByCode,
  resolveHsnById,
  resolveLineGstFromMasters,
  type GstDocumentApplicability,
  type AccountingGstRateLookup,
} from '../accounting/shared/master-resolvers/accounting-tax-resolver.js'
import { resolveGstStateCode } from '../accounting/receivables/validation/state-code.validator.js'
import { isUnionTerritoryStateCode } from './union-territory.js'
import {
  applyZeroRatedTreatmentToRates,
  assessLutRequirement,
  type ZeroRatedPaymentMode,
} from '../accounting/tax-compliance/export-sez-lut.util.js'
import {
  classifyGstSupply,
  isCompositionScheme,
  type GstSupplyClass,
} from '../accounting/tax-compliance/gst-specials.util.js'

export type GstTaxScheme = 'cgst_sgst' | 'igst' | 'utgst_pair'

/** Aligns with platform tax categories (Phase 1 + Phase 10 zero-rated + Phase 11 specials). */
export type GstTaxCategory =
  | 'TAXABLE'
  | 'NIL_RATED'
  | 'EXEMPT'
  | 'ZERO_RATED'
  | 'NON_GST'
  | 'REVERSE_CHARGE'
  | 'COMPOSITION'
  | 'UNRESOLVED'

export type ResolveGstTaxRequest = {
  tenantId: string
  applicableFor: GstDocumentApplicability
  asOfDate?: string | null
  /** Supplier / LE / plant state (sales: seller; purchase: vendor). */
  fromState?: string | null
  /** Place of supply / customer or receiving state. */
  toState?: string | null
  legalEntityId?: string | null
  branchId?: string | null
  customerOrVendorId?: string | null
  gstGroupId?: string | null
  hsnId?: string | null
  hsnCode?: string | null
  itemId?: string | null
  /** When true, force reverse-charge classification (RCM documents). */
  reverseChargeHint?: boolean
  /**
   * Phase 10 — commercial zero-rated treatment
   * (EXPORT_WITH_TAX | EXPORT_WITHOUT_TAX | SEZ_WITH_TAX | SEZ_WITHOUT_TAX).
   */
  taxTreatmentHint?: string | null
  /** Covering LUT presence for WOPAY (from LUT master); optional for soft assess. */
  lutPresent?: boolean | null
  companyGstin?: string | null
  /** Phase 11 — explicit nil/exempt/non-gst when not export/SEZ. */
  taxCategoryHint?: string | null
  /** Seller LE registration type (REGULAR / COMPOSITION). */
  registrationScheme?: string | null
  partyRegistrationScheme?: string | null
}

export type ResolveGstTaxResult = {
  resolved: boolean
  hsnSacCode: string | null
  hsnId: string | null
  gstGroupId: string | null
  taxCategory: GstTaxCategory
  /** Phase 11 supply class (ledger visibility). */
  supplyClass: GstSupplyClass
  gstRate: number
  taxScheme: GstTaxScheme
  cgstRate: number
  sgstRate: number
  utgstRate: number
  igstRate: number
  cessRate: number
  reverseCharge: boolean
  ruleId: string | null
  ruleCode: string | null
  ruleVersion: string | null
  source: 'MASTER' | 'UNRESOLVED'
  fromStateSnapshot: string | null
  toStateSnapshot: string | null
  warnings: string[]
  blockers: string[]
  specialSchemeFlags: string[]
  /** Raw master rates before scheme application (for audit). */
  masterRate: AccountingGstRateLookup | null
  /** Phase 10 */
  taxTreatmentHint: string | null
  zeroRatedPaymentMode: ZeroRatedPaymentMode | null
}

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Apply place-of-supply scheme to master CGST/SGST/IGST/(UTGST)/cess components. */
export function applySchemeToMasterRate(
  master: Pick<
    AccountingGstRateLookup,
    'cgstRate' | 'sgstRate' | 'igstRate' | 'gstRate'
  > & { utgstRate?: number | string | null; cessRate?: number | string | null },
  opts: { isInterstate: boolean; isUnionTerritory?: boolean },
): {
  taxScheme: GstTaxScheme
  cgstRate: number
  sgstRate: number
  utgstRate: number
  igstRate: number
  gstRate: number
  cessRate: number
} {
  const cgst = num(master.cgstRate)
  const sgst = num(master.sgstRate)
  const igstMaster = num(master.igstRate)
  const utgstMaster = num(master.utgstRate)
  const cessRate = num(master.cessRate)
  const combinedIntra = cgst + sgst
  const effectiveIgst = igstMaster > 0 ? igstMaster : combinedIntra

  if (opts.isInterstate) {
    return {
      taxScheme: 'igst',
      cgstRate: 0,
      sgstRate: 0,
      utgstRate: 0,
      igstRate: effectiveIgst,
      gstRate: effectiveIgst,
      cessRate,
    }
  }

  // Intra-state in Union Territory → CGST + UTGST (never IGST; clear SGST)
  if (opts.isUnionTerritory) {
    const ut = utgstMaster > 0 ? utgstMaster : sgst > 0 ? sgst : combinedIntra / 2
    const cg = cgst > 0 ? cgst : combinedIntra / 2
    const total = cg + ut
    return {
      taxScheme: 'utgst_pair',
      cgstRate: cg,
      sgstRate: 0,
      utgstRate: ut,
      igstRate: 0,
      gstRate: total > 0 ? total : effectiveIgst,
      cessRate,
    }
  }

  if (combinedIntra > 0) {
    return {
      taxScheme: 'cgst_sgst',
      cgstRate: cgst,
      sgstRate: sgst,
      utgstRate: 0,
      igstRate: 0,
      gstRate: combinedIntra,
      cessRate,
    }
  }

  return {
    taxScheme: 'cgst_sgst',
    cgstRate: effectiveIgst / 2,
    sgstRate: effectiveIgst / 2,
    utgstRate: 0,
    igstRate: 0,
    gstRate: effectiveIgst,
    cessRate,
  }
}

function inferInterstate(fromState?: string | null, toState?: string | null): {
  isInterstate: boolean
  fromCode: string | null
  toCode: string | null
  warnings: string[]
} {
  const warnings: string[] = []
  const fromCode = resolveGstStateCode(fromState) ?? (fromState?.trim() || null)
  const toCode = resolveGstStateCode(toState) ?? (toState?.trim() || null)
  if (!fromCode || !toCode) {
    warnings.push('Place of supply or counterparty state incomplete — using master rate lane preference only')
    return { isInterstate: false, fromCode, toCode, warnings }
  }
  const a = fromCode.length === 2 ? fromCode : fromCode.toLowerCase()
  const b = toCode.length === 2 ? toCode : toCode.toLowerCase()
  return { isInterstate: a !== b, fromCode, toCode, warnings }
}

function categoryFromRate(gstRate: number, reverseCharge: boolean): GstTaxCategory {
  if (reverseCharge) return 'REVERSE_CHARGE'
  if (gstRate === 0) return 'NIL_RATED'
  return 'TAXABLE'
}

function baseUnresolved(
  partial: Partial<ResolveGstTaxResult> &
    Pick<ResolveGstTaxResult, 'hsnSacCode' | 'hsnId' | 'gstGroupId' | 'warnings' | 'blockers' | 'fromStateSnapshot' | 'toStateSnapshot' | 'reverseCharge'>,
): ResolveGstTaxResult {
  return {
    resolved: false,
    taxCategory: 'UNRESOLVED',
    supplyClass: 'UNRESOLVED',
    gstRate: 0,
    taxScheme: 'cgst_sgst',
    cgstRate: 0,
    sgstRate: 0,
    utgstRate: 0,
    igstRate: 0,
    cessRate: 0,
    ruleId: null,
    ruleCode: null,
    ruleVersion: null,
    source: 'UNRESOLVED',
    specialSchemeFlags: [],
    masterRate: null,
    taxTreatmentHint: null,
    zeroRatedPaymentMode: null,
    ...partial,
  }
}

/**
 * Resolve full line-tax determination. Never invents a default 18% rate.
 */
export async function resolveGstTax(input: ResolveGstTaxRequest): Promise<ResolveGstTaxResult> {
  const warnings: string[] = []
  const blockers: string[] = []
  const specialSchemeFlags: string[] = []

  let fromState = input.fromState ?? null
  let toState = input.toState ?? null
  let registrationScheme = input.registrationScheme ?? null

  if (input.legalEntityId && !fromState) {
    const le = await prisma.legalEntity.findFirst({
      where: { id: input.legalEntityId, tenantId: input.tenantId, deletedAt: null },
      select: { stateCode: true, gstin: true },
    })
    if (le) {
      fromState = le.stateCode ?? (le.gstin ? le.gstin.slice(0, 2) : null)
    }
  }
  if (input.branchId && !fromState) {
    const br = await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId, deletedAt: null },
      select: { stateCode: true, gstin: true },
    })
    if (br) {
      fromState = br.stateCode ?? (br.gstin ? br.gstin.slice(0, 2) : null)
    }
  }

  // Phase 11 — composition / registration scheme from GstRegistration when not passed.
  if (input.legalEntityId && !registrationScheme) {
    const reg = await prisma.gstRegistration.findFirst({
      where: { tenantId: input.tenantId, legalEntityId: input.legalEntityId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { registrationType: true },
    })
    if (reg?.registrationType) registrationScheme = reg.registrationType
  }
  if (isCompositionScheme(registrationScheme)) specialSchemeFlags.push('COMPOSITION_SELLER')
  if (isCompositionScheme(input.partyRegistrationScheme)) specialSchemeFlags.push('COMPOSITION_PARTY')

  let hsnSacCode: string | null = input.hsnCode?.trim() || null
  let hsnId: string | null = input.hsnId ?? null
  let gstGroupId: string | null = input.gstGroupId ?? null

  if (input.itemId) {
    const item = await prisma.masterItem.findFirst({
      where: { id: input.itemId, tenantId: input.tenantId, deletedAt: null },
      select: { hsnCode: true, hsnId: true, gstGroupId: true },
    })
    if (item) {
      hsnSacCode = hsnSacCode || item.hsnCode || null
      hsnId = hsnId || item.hsnId
      gstGroupId = gstGroupId || item.gstGroupId
    } else {
      blockers.push('Item not found for tax resolution')
    }
  }

  if (hsnId && !hsnSacCode) {
    const hsn = await resolveHsnById(input.tenantId, hsnId)
    if (hsn) {
      hsnSacCode = hsn.code
      gstGroupId = gstGroupId || hsn.gstGroupId
    }
  }
  if (!hsnId && hsnSacCode) {
    const hsn = await resolveHsnByCode(input.tenantId, hsnSacCode)
    if (hsn) {
      hsnId = hsn.id
      gstGroupId = gstGroupId || hsn.gstGroupId
    }
  }

  if (!hsnSacCode && !gstGroupId && !input.itemId) {
    blockers.push('HSN/SAC, GST group, or item is required to resolve GST')
  }
  if (!hsnSacCode && gstGroupId) {
    warnings.push('HSN/SAC missing — resolved from GST group only')
  }

  const master = await resolveLineGstFromMasters({
    tenantId: input.tenantId,
    applicableFor: input.applicableFor,
    asOfDate: input.asOfDate,
    fromState,
    toState,
    gstGroupId,
    hsnId,
    hsnCode: hsnSacCode,
    itemId: input.itemId,
  })

  const supply = inferInterstate(fromState, toState)
  warnings.push(...supply.warnings)

  if (!master) {
    blockers.push('GST rule unresolved — link item HSN/GST group and configure an effective MasterGstRate')
    return baseUnresolved({
      hsnSacCode,
      hsnId,
      gstGroupId,
      reverseCharge: Boolean(input.reverseChargeHint),
      fromStateSnapshot: supply.fromCode,
      toStateSnapshot: supply.toCode,
      warnings,
      blockers,
      specialSchemeFlags,
      taxTreatmentHint: input.taxTreatmentHint?.trim() || null,
      zeroRatedPaymentMode: null,
    })
  }

  const scheme = applySchemeToMasterRate(master, {
    isInterstate: supply.isInterstate,
    isUnionTerritory: !supply.isInterstate && isUnionTerritoryStateCode(supply.toCode),
  })
  const reverseCharge = Boolean(input.reverseChargeHint)

  // Phase 10 — override scheme for export/SEZ zero-rated commercial treatments
  const zeroRated = applyZeroRatedTreatmentToRates({
    taxTreatment: input.taxTreatmentHint,
    cgstRate: scheme.cgstRate,
    sgstRate: scheme.sgstRate,
    utgstRate: scheme.utgstRate,
    igstRate: scheme.igstRate,
    gstRate: scheme.gstRate,
  })
  warnings.push(...zeroRated.warnings)
  blockers.push(...zeroRated.blockers)

  let gstRate = zeroRated.applied ? zeroRated.gstRate : scheme.gstRate
  let cgstRate = zeroRated.applied ? zeroRated.cgstRate : scheme.cgstRate
  let sgstRate = zeroRated.applied ? zeroRated.sgstRate : scheme.sgstRate
  let utgstRate = zeroRated.applied ? zeroRated.utgstRate : scheme.utgstRate
  let igstRate = zeroRated.applied ? zeroRated.igstRate : scheme.igstRate
  let taxScheme: GstTaxScheme = zeroRated.applied && zeroRated.taxScheme === 'igst' ? 'igst' : scheme.taxScheme

  let taxCategory: GstTaxCategory = reverseCharge
    ? 'REVERSE_CHARGE'
    : zeroRated.applied && zeroRated.taxCategory === 'ZERO_RATED'
      ? 'ZERO_RATED'
      : categoryFromRate(gstRate, reverseCharge)

  // Soft LUT presence check when caller indicated no covering bond
  if (zeroRated.paymentMode === 'WOPAY' && input.lutPresent === false) {
    const soft = assessLutRequirement({
      taxTreatment: input.taxTreatmentHint,
      lut: null,
      asOfDate: input.asOfDate || new Date().toISOString().slice(0, 10),
      companyGstin: input.companyGstin,
      hardBlock: false,
    })
    warnings.push(...soft.warnings)
  }

  // Phase 11 — nil/exempt/non-gst/composition classification (does not own export/LUT — Phase 10 does).
  const classification = classifyGstSupply({
    gstRate,
    reverseCharge,
    taxCategoryHint:
      input.taxCategoryHint ??
      (taxCategory === 'ZERO_RATED' ? 'ZERO_RATED' : taxCategory === 'REVERSE_CHARGE' ? 'REVERSE_CHARGE' : null),
    taxTreatment: input.taxTreatmentHint,
    registrationScheme,
    partyRegistrationScheme: input.partyRegistrationScheme,
  })
  warnings.push(...classification.warnings)
  blockers.push(...classification.blockers)

  // Prefer Phase 10 ZERO_RATED; otherwise apply Phase 11 special class (nil/exempt/non_gst/composition).
  if (!zeroRated.applied || taxCategory !== 'ZERO_RATED') {
    if (
      classification.supplyClass === 'NIL_RATED' ||
      classification.supplyClass === 'EXEMPT' ||
      classification.supplyClass === 'NON_GST' ||
      classification.supplyClass === 'COMPOSITION'
    ) {
      taxCategory = classification.supplyClass as GstTaxCategory
      if (
        classification.supplyClass !== 'COMPOSITION' ||
        gstRate === 0 ||
        Boolean(input.taxCategoryHint)
      ) {
        // Force zero components for nil/exempt/non-gst when explicitly classified
        if (
          classification.supplyClass === 'NIL_RATED' ||
          classification.supplyClass === 'EXEMPT' ||
          classification.supplyClass === 'NON_GST'
        ) {
          cgstRate = 0
          sgstRate = 0
          utgstRate = 0
          igstRate = 0
          gstRate = 0
        }
      }
    }
  } else {
    specialSchemeFlags.push('ZERO_RATED_EXPORT_SEZ')
  }

  if (classification.isZeroTaxVisible) specialSchemeFlags.push('ZERO_TAX_VISIBLE')
  if (classification.supplyClass === 'COMPOSITION') specialSchemeFlags.push('COMPOSITION_SUPPLY')

  if (!zeroRated.applied && gstRate === 0 && taxCategory === 'NIL_RATED' && !input.taxCategoryHint) {
    warnings.push('Resolved GST rate is 0% (nil/zero rated or zero master components)')
  }

  return {
    resolved: true,
    hsnSacCode,
    hsnId,
    gstGroupId: master.gstGroupId,
    taxCategory,
    supplyClass: taxCategory === 'ZERO_RATED' ? 'ZERO_RATED' : classification.supplyClass,
    gstRate,
    taxScheme,
    cgstRate,
    sgstRate,
    utgstRate,
    igstRate,
    cessRate: scheme.cessRate,
    reverseCharge,
    ruleId: master.id,
    ruleCode: master.code,
    ruleVersion: `${master.dateFrom}:${master.dateTo ?? 'open'}`,
    source: 'MASTER',
    fromStateSnapshot: supply.fromCode,
    toStateSnapshot: supply.toCode,
    warnings,
    blockers,
    specialSchemeFlags,
    masterRate: master,
    taxTreatmentHint: input.taxTreatmentHint?.trim() || null,
    zeroRatedPaymentMode: zeroRated.paymentMode,
  }
}
