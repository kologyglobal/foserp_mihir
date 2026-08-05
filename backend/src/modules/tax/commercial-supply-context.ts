/**
 * Commercial document Place of Supply + Supply Type resolution (authoritative pure functions).
 * Frontend may preview; backend must recompute on write where possible.
 */
import { resolveGstStateCode } from '../accounting/receivables/validation/state-code.validator.js'
import { isUnionTerritoryStateCode } from './union-territory.js'

export type CommercialPlaceOfSupplySource =
  | 'AUTO'
  | 'CUSTOMER'
  | 'SHIP_TO'
  | 'BILL_TO'
  | 'OVERRIDE'

export type CommercialSupplyType = 'INTRA_STATE' | 'INTER_STATE' | 'UNRESOLVED'

export type CommercialGstScheme = 'cgst_sgst' | 'igst' | 'utgst_pair' | 'UNRESOLVED'

export interface ResolveCommercialPlaceOfSupplyInput {
  /** When true, use placeOfSupplyOverrideValue as final PoS (requires reason at service layer). */
  placeOfSupplyOverride?: boolean
  placeOfSupplyOverrideValue?: string | null
  shipToState?: string | null
  shipToStateCode?: string | null
  billToState?: string | null
  billToStateCode?: string | null
  customerState?: string | null
  customerGstin?: string | null
  explicitPlaceOfSupply?: string | null
  isServiceDocument?: boolean
}

export interface CommercialPlaceOfSupplyResult {
  placeOfSupplyStateCode: string | null
  placeOfSupplyLabel: string | null
  source: CommercialPlaceOfSupplySource
  warnings: string[]
}

export interface ResolveCommercialSupplyTypeInput {
  supplierStateCode?: string | null
  supplierState?: string | null
  supplierGstin?: string | null
  placeOfSupplyStateCode?: string | null
}

export interface CommercialSupplyTypeResult {
  supplyType: CommercialSupplyType
  taxScheme: CommercialGstScheme
  supplierStateCode: string | null
  placeOfSupplyStateCode: string | null
  isUnionTerritory: boolean
  unresolved: boolean
  warnings: string[]
}

function code(v?: string | null): string | null {
  return resolveGstStateCode(v) ?? null
}

/**
 * Prefer ship-to for goods, bill-to for services; override wins when flagged.
 */
export function resolveCommercialPlaceOfSupply(
  input: ResolveCommercialPlaceOfSupplyInput,
): CommercialPlaceOfSupplyResult {
  const warnings: string[] = []

  if (input.placeOfSupplyOverride) {
    const overrideCode =
      code(input.placeOfSupplyOverrideValue) ??
      code(input.explicitPlaceOfSupply)
    if (!overrideCode) {
      warnings.push('Place of Supply override flag set but value could not be resolved to a GST state code')
      return {
        placeOfSupplyStateCode: null,
        placeOfSupplyLabel: input.placeOfSupplyOverrideValue?.trim() || null,
        source: 'OVERRIDE',
        warnings,
      }
    }
    return {
      placeOfSupplyStateCode: overrideCode,
      placeOfSupplyLabel: input.placeOfSupplyOverrideValue?.trim() || overrideCode,
      source: 'OVERRIDE',
      warnings,
    }
  }

  if (input.explicitPlaceOfSupply?.trim()) {
    const c = code(input.explicitPlaceOfSupply)
    if (c) {
      return {
        placeOfSupplyStateCode: c,
        placeOfSupplyLabel: input.explicitPlaceOfSupply.trim(),
        source: 'AUTO',
        warnings,
      }
    }
  }

  // Goods: ship-to first; services: bill-to first
  const primary = input.isServiceDocument
    ? [input.billToStateCode, input.billToState, input.shipToStateCode, input.shipToState]
    : [input.shipToStateCode, input.shipToState, input.billToStateCode, input.billToState]
  for (const p of primary) {
    const c = code(p)
    if (c) {
      const source: CommercialPlaceOfSupplySource = input.isServiceDocument
        ? code(input.billToStateCode) || code(input.billToState)
          ? 'BILL_TO'
          : 'SHIP_TO'
        : code(input.shipToStateCode) || code(input.shipToState)
          ? 'SHIP_TO'
          : 'BILL_TO'
      return {
        placeOfSupplyStateCode: c,
        placeOfSupplyLabel: p ?? c,
        source,
        warnings,
      }
    }
  }

  const customerCode = code(input.customerState) ?? code(input.customerGstin)
  if (customerCode) {
    return {
      placeOfSupplyStateCode: customerCode,
      placeOfSupplyLabel: input.customerState ?? customerCode,
      source: 'CUSTOMER',
      warnings,
    }
  }

  warnings.push('Place of Supply could not be determined from ship-to, bill-to, or customer GST registration')
  return {
    placeOfSupplyStateCode: null,
    placeOfSupplyLabel: null,
    source: 'AUTO',
    warnings,
  }
}

/**
 * Compare supplier registration state vs Place of Supply state → Intra/Inter/Unresolved + scheme.
 */
export function resolveCommercialSupplyType(
  input: ResolveCommercialSupplyTypeInput,
): CommercialSupplyTypeResult {
  const warnings: string[] = []
  const supplierStateCode =
    code(input.supplierStateCode) ?? code(input.supplierState) ?? code(input.supplierGstin)
  const placeOfSupplyStateCode = code(input.placeOfSupplyStateCode)

  if (!supplierStateCode || !placeOfSupplyStateCode) {
    warnings.push(
      !supplierStateCode
        ? 'Supplier / legal entity state is missing — supply type unresolved'
        : 'Place of Supply state is missing — supply type unresolved',
    )
    return {
      supplyType: 'UNRESOLVED',
      taxScheme: 'UNRESOLVED',
      supplierStateCode,
      placeOfSupplyStateCode,
      isUnionTerritory: isUnionTerritoryStateCode(placeOfSupplyStateCode),
      unresolved: true,
      warnings,
    }
  }

  if (supplierStateCode === placeOfSupplyStateCode) {
    const ut = isUnionTerritoryStateCode(placeOfSupplyStateCode)
    return {
      supplyType: 'INTRA_STATE',
      taxScheme: ut ? 'utgst_pair' : 'cgst_sgst',
      supplierStateCode,
      placeOfSupplyStateCode,
      isUnionTerritory: ut,
      unresolved: false,
      warnings,
    }
  }

  return {
    supplyType: 'INTER_STATE',
    taxScheme: 'igst',
    supplierStateCode,
    placeOfSupplyStateCode,
    isUnionTerritory: false,
    unresolved: false,
    warnings,
  }
}

export function formatSupplyTypeLabel(t: CommercialSupplyType): string {
  if (t === 'INTRA_STATE') return 'Intra-state'
  if (t === 'INTER_STATE') return 'Inter-state'
  return 'Unresolved'
}

export function formatTaxSchemeLabel(s: CommercialGstScheme): string {
  if (s === 'igst') return 'IGST'
  if (s === 'utgst_pair') return 'CGST + UTGST'
  if (s === 'cgst_sgst') return 'CGST + SGST'
  return 'Unresolved'
}
