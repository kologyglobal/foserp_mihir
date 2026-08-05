/**
 * Commercial Place of Supply + supply type (FE preview; BE is authoritative on write).
 * Mirrors backend commercial-supply-context.ts.
 */
import { formatPlaceOfSupplyLabel, resolveGstStateCode } from './gstStateCode'

export type CommercialPlaceOfSupplySource =
  | 'AUTO'
  | 'CUSTOMER'
  | 'SHIP_TO'
  | 'BILL_TO'
  | 'OVERRIDE'

export type CommercialSupplyType = 'INTRA_STATE' | 'INTER_STATE' | 'UNRESOLVED'
export type CommercialGstScheme = 'cgst_sgst' | 'igst' | 'utgst_pair' | 'UNRESOLVED'

/** Indian Union Territory GST codes (CGST + UTGST intra). */
const UNION_TERRITORY_GST_CODES = new Set([
  '01', '04', '07', '26', '31', '34', '35', '38',
])

export function isUnionTerritoryStateCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false
  return UNION_TERRITORY_GST_CODES.has(code.trim().padStart(2, '0'))
}

export function resolveCommercialPlaceOfSupply(input: {
  placeOfSupplyOverride?: boolean
  placeOfSupplyOverrideValue?: string | null
  shipToState?: string | null
  billToState?: string | null
  customerState?: string | null
  customerGstin?: string | null
  explicitPlaceOfSupply?: string | null
  isServiceDocument?: boolean
}): {
  placeOfSupplyStateCode: string | null
  placeOfSupplyLabel: string | null
  source: CommercialPlaceOfSupplySource
  warnings: string[]
} {
  const warnings: string[] = []
  const code = (v?: string | null) => resolveGstStateCode(v)

  if (input.placeOfSupplyOverride) {
    const overrideCode =
      code(input.placeOfSupplyOverrideValue) ?? code(input.explicitPlaceOfSupply)
    if (!overrideCode) {
      warnings.push('Override value could not be resolved to a GST state code')
      return {
        placeOfSupplyStateCode: null,
        placeOfSupplyLabel: input.placeOfSupplyOverrideValue?.trim() || null,
        source: 'OVERRIDE',
        warnings,
      }
    }
    return {
      placeOfSupplyStateCode: overrideCode,
      placeOfSupplyLabel:
        formatPlaceOfSupplyLabel(overrideCode, input.placeOfSupplyOverrideValue) ||
        overrideCode,
      source: 'OVERRIDE',
      warnings,
    }
  }

  if (input.explicitPlaceOfSupply?.trim()) {
    const c = code(input.explicitPlaceOfSupply)
    if (c) {
      return {
        placeOfSupplyStateCode: c,
        placeOfSupplyLabel: formatPlaceOfSupplyLabel(c, input.explicitPlaceOfSupply) || c,
        source: 'AUTO',
        warnings,
      }
    }
  }

  const primary = input.isServiceDocument
    ? [input.billToState, input.shipToState]
    : [input.shipToState, input.billToState]
  for (const p of primary) {
    const c = code(p)
    if (c) {
      return {
        placeOfSupplyStateCode: c,
        placeOfSupplyLabel: formatPlaceOfSupplyLabel(c, p) || c,
        source: input.isServiceDocument ? 'BILL_TO' : 'SHIP_TO',
        warnings,
      }
    }
  }

  const customerCode = code(input.customerState) ?? code(input.customerGstin)
  if (customerCode) {
    return {
      placeOfSupplyStateCode: customerCode,
      placeOfSupplyLabel:
        formatPlaceOfSupplyLabel(customerCode, input.customerState) || customerCode,
      source: 'CUSTOMER',
      warnings,
    }
  }

  warnings.push('Place of Supply could not be determined')
  return {
    placeOfSupplyStateCode: null,
    placeOfSupplyLabel: null,
    source: 'AUTO',
    warnings,
  }
}

export function resolveCommercialSupplyType(input: {
  supplierStateCode?: string | null
  supplierState?: string | null
  supplierGstin?: string | null
  placeOfSupplyStateCode?: string | null
}): {
  supplyType: CommercialSupplyType
  taxScheme: CommercialGstScheme
  supplierStateCode: string | null
  placeOfSupplyStateCode: string | null
  isUnionTerritory: boolean
  unresolved: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  const supplierStateCode =
    resolveGstStateCode(input.supplierStateCode) ??
    resolveGstStateCode(input.supplierState) ??
    resolveGstStateCode(input.supplierGstin)
  const placeOfSupplyStateCode = resolveGstStateCode(input.placeOfSupplyStateCode)

  if (!supplierStateCode || !placeOfSupplyStateCode) {
    warnings.push(
      !supplierStateCode
        ? 'Supplier / legal entity state is missing'
        : 'Place of Supply state is missing',
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

export function formatTaxSchemeLabel(s: CommercialGstScheme | string): string {
  if (s === 'igst') return 'IGST'
  if (s === 'utgst_pair' || s === 'cgst_utgst') return 'CGST + UTGST'
  if (s === 'cgst_sgst') return 'CGST + SGST'
  return 'Unresolved'
}
