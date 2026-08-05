/**
 * Dual-mode commercial line tax determination (Phase 1).
 * API → backend resolveGstTax; demo → MasterGstRate via item HSN/group.
 * Never invents a silent default rate — unresolved returns blockers.
 */
import { isApiMode } from '../config/apiConfig'
import {
  resolveGstTaxFromMasters,
  type ResolveGstTaxParams,
  type ResolveGstTaxResultDto,
} from '../services/accounting/taxResolutionApi'
import type { Item } from '../types/master'
import type { GstRate, HsnMaster } from '../types/taxMaster'
import { determinePurchaseGstSupply, determineSalesGstSupply } from './gstSupply'
import type { GstScheme } from '../types/invoice'

export type CommercialTaxDirection = 'SALES' | 'PURCHASE'

export type LineTaxSnapshot = {
  resolved: boolean
  hsnSacCode: string
  taxPct: number
  taxScheme: GstScheme
  cgstRate: number
  sgstRate: number
  igstRate: number
  cessRate: number
  taxCategory: string
  reverseCharge: boolean
  ruleId: string | null
  source: 'MASTER' | 'UNRESOLVED' | 'OVERRIDE'
  warnings: string[]
  blockers: string[]
}

export type ResolveLineTaxInput = {
  direction: CommercialTaxDirection
  item: Item | null | undefined
  asOfDate?: string
  companyState?: string | null
  companyStateCode?: string | null
  companyGstin?: string | null
  partyState?: string | null
  partyGstin?: string | null
  placeOfSupply?: string | null
  reverseCharge?: boolean
  /** Demo masters */
  hsnById?: (id: string) => HsnMaster | undefined
  hsnByCode?: (code: string) => HsnMaster | undefined
  gstRates?: GstRate[]
}

function applyScheme(
  cgst: number,
  sgst: number,
  igst: number,
  isInterstate: boolean,
): Pick<LineTaxSnapshot, 'taxScheme' | 'cgstRate' | 'sgstRate' | 'igstRate' | 'taxPct'> {
  const combinedIntra = cgst + sgst
  const effectiveIgst = igst > 0 ? igst : combinedIntra
  if (isInterstate) {
    return {
      taxScheme: 'igst',
      cgstRate: 0,
      sgstRate: 0,
      igstRate: effectiveIgst,
      taxPct: effectiveIgst,
    }
  }
  if (combinedIntra > 0) {
    return {
      taxScheme: 'cgst_sgst',
      cgstRate: cgst,
      sgstRate: sgst,
      igstRate: 0,
      taxPct: combinedIntra,
    }
  }
  return {
    taxScheme: 'cgst_sgst',
    cgstRate: effectiveIgst / 2,
    sgstRate: effectiveIgst / 2,
    igstRate: 0,
    taxPct: effectiveIgst,
  }
}

function unresolved(hsn: string, blockers: string[], warnings: string[] = []): LineTaxSnapshot {
  return {
    resolved: false,
    hsnSacCode: hsn,
    taxPct: 0,
    taxScheme: 'cgst_sgst',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cessRate: 0,
    taxCategory: 'UNRESOLVED',
    reverseCharge: false,
    ruleId: null,
    source: 'UNRESOLVED',
    warnings,
    blockers,
  }
}

function isInterstateForDirection(input: ResolveLineTaxInput): boolean {
  if (input.direction === 'PURCHASE') {
    return determinePurchaseGstSupply({
      supplierState: input.partyState,
      supplierGstin: input.partyGstin,
      placeOfSupply: input.placeOfSupply,
      defaultPlaceOfSupplyState: input.companyState,
      defaultPlaceOfSupplyStateCode: input.companyStateCode,
    }).isInterstate
  }
  return determineSalesGstSupply({
    companyState: input.companyState,
    companyStateCode: input.companyStateCode,
    companyGstin: input.companyGstin,
    customerPlaceOfSupply: input.placeOfSupply,
    customerState: input.partyState,
    customerGstin: input.partyGstin,
  }).isInterstate
}

/** Pure demo/local resolution from seed masters. */
export function resolveLineTaxFromLocalMasters(input: ResolveLineTaxInput): LineTaxSnapshot {
  const item = input.item
  if (!item) {
    return unresolved('', ['Select an item before tax can be resolved'])
  }

  let hsnCode = (item.hsnCode ?? '').trim()
  let gstGroupId = item.gstGroupId ?? null

  if (item.hsnId && input.hsnById) {
    const hsn = input.hsnById(item.hsnId)
    if (hsn) {
      hsnCode = hsn.code
      gstGroupId = gstGroupId || hsn.gstGroupId
    }
  }
  if (!gstGroupId && hsnCode && input.hsnByCode) {
    const hsn = input.hsnByCode(hsnCode)
    if (hsn) gstGroupId = hsn.gstGroupId
  }

  if (!gstGroupId) {
    return unresolved(hsnCode, [
      'GST rule unresolved — set HSN and GST group on the item master',
    ])
  }

  const asOf = input.asOfDate ? new Date(`${input.asOfDate}T00:00:00`) : new Date()
  const rates = (input.gstRates ?? []).filter(
    (r) =>
      r.isActive &&
      r.gstGroupId === gstGroupId &&
      (r.applicableFor === 'BOTH' || r.applicableFor === input.direction) &&
      new Date(r.dateFrom) <= asOf &&
      (r.dateTo == null || new Date(r.dateTo) >= asOf),
  )

  if (!rates.length) {
    return unresolved(hsnCode, [
      'No effective GST rate master for this item group and date',
    ])
  }

  // Prefer most recent dateFrom
  rates.sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))
  const best = rates[0]!
  const interstate = isInterstateForDirection(input)
  const scheme = applyScheme(best.cgst, best.sgst, best.igst, interstate)

  return {
    resolved: true,
    hsnSacCode: hsnCode,
    ...scheme,
    cessRate: 0,
    taxCategory: scheme.taxPct === 0 ? 'NIL_RATED' : 'TAXABLE',
    reverseCharge: Boolean(input.reverseCharge),
    ruleId: best.id,
    source: 'MASTER',
    warnings: [],
    blockers: [],
  }
}

function fromApiDto(dto: ResolveGstTaxResultDto): LineTaxSnapshot {
  const taxScheme: GstScheme = dto.taxScheme === 'igst' ? 'igst' : 'cgst_sgst'
  return {
    resolved: dto.resolved,
    hsnSacCode: dto.hsnSacCode ?? '',
    taxPct: dto.gstRate,
    taxScheme,
    cgstRate: dto.cgstRate,
    sgstRate: dto.sgstRate,
    igstRate: dto.igstRate,
    cessRate: dto.cessRate ?? 0,
    taxCategory: dto.taxCategory,
    reverseCharge: dto.reverseCharge,
    ruleId: dto.ruleId,
    source: dto.resolved ? 'MASTER' : 'UNRESOLVED',
    warnings: dto.warnings ?? [],
    blockers: dto.blockers ?? [],
  }
}

/** Async dual-mode resolve for line forms. */
export async function resolveCommercialLineTax(
  input: ResolveLineTaxInput,
): Promise<LineTaxSnapshot> {
  if (!input.item?.id) {
    return unresolved('', ['Select an item before tax can be resolved'])
  }

  if (isApiMode()) {
    const params: ResolveGstTaxParams = {
      applicableFor: input.direction,
      asOfDate: input.asOfDate,
      fromState: input.companyStateCode ?? input.companyState ?? undefined,
      toState: input.placeOfSupply ?? input.partyState ?? undefined,
      itemId: input.item.id,
      hsnCode: input.item.hsnCode || undefined,
      gstGroupId: input.item.gstGroupId || undefined,
      ...(input.reverseCharge != null ? { reverseCharge: input.reverseCharge } : {}),
    }
    try {
      const dto = await resolveGstTaxFromMasters(params)
      if (dto) return fromApiDto(dto)
      return unresolved(input.item.hsnCode ?? '', [
        'Tax resolve API returned no rate — check HSN/GST masters',
      ])
    } catch {
      return unresolved(input.item.hsnCode ?? '', [
        'Tax resolve request failed — check HSN/GST masters or server logs',
      ])
    }
  }

  return resolveLineTaxFromLocalMasters(input)
}

export function lineTaxAmounts(
  taxableValue: number,
  snap: Pick<LineTaxSnapshot, 'cgstRate' | 'sgstRate' | 'igstRate' | 'taxPct' | 'taxScheme'>,
): { cgstAmount: number; sgstAmount: number; igstAmount: number; gstAmount: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  if (snap.taxScheme === 'igst') {
    const igstAmount = r2(taxableValue * (snap.igstRate / 100))
    return { cgstAmount: 0, sgstAmount: 0, igstAmount, gstAmount: igstAmount }
  }
  const cgstAmount = r2(taxableValue * (snap.cgstRate / 100))
  const sgstAmount = r2(taxableValue * (snap.sgstRate / 100))
  return { cgstAmount, sgstAmount, igstAmount: 0, gstAmount: r2(cgstAmount + sgstAmount) }
}
