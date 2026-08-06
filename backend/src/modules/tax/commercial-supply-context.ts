/**
 * Commercial document Place of Supply + Supply Type resolution (authoritative pure functions).
 * Frontend mirrors this in commercialSupplyContext.ts for preview; backend recompute on write.
 *
 * Priority (goods, subject to service flag reverse for address):
 * 1. Authorised Place of Supply override
 * 2. Ship-to / delivery state
 * 3. Customer GST registration (GSTIN state)
 * 4. Bill-to state
 * 5. Customer master state
 * 6. Unresolved
 */
import { resolveGstStateCode } from '../accounting/receivables/validation/state-code.validator.js'
import { isUnionTerritoryStateCode } from './union-territory.js'

export type CommercialPlaceOfSupplySource =
  | 'AUTO'
  | 'CUSTOMER'
  | 'CUSTOMER_GSTIN'
  | 'SHIP_TO'
  | 'BILL_TO'
  | 'OVERRIDE'
  | 'UNRESOLVED'

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
  /** Prefer GSTIN state before bare customer master state. */
  customerGstin?: string | null
  /**
   * Optional sticky value — only used when placeOfSupplyOverride is true.
   * Auto resolution must never treat prior saved PoS as authoritative.
   * @deprecated Prefer placeOfSupplyOverrideValue for overrides.
   */
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

function labelledCode(
  raw: string | null | undefined,
  fallbackLabel?: string | null,
): { c: string; label: string } | null {
  const c = code(raw)
  if (!c) return null
  return { c, label: (raw?.trim() || fallbackLabel || c) as string }
}

/**
 * Prefer ship-to for goods, bill-to for services; override wins when flagged.
 * Never uses a previously saved non-override PoS as auto priority.
 */
export function resolveCommercialPlaceOfSupply(
  input: ResolveCommercialPlaceOfSupplyInput,
): CommercialPlaceOfSupplyResult {
  const warnings: string[] = []

  if (input.placeOfSupplyOverride) {
    const overrideCode =
      code(input.placeOfSupplyOverrideValue) ?? code(input.explicitPlaceOfSupply)
    if (!overrideCode) {
      warnings.push(
        'Place of Supply override flag set but value could not be resolved to a GST state code',
      )
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

  // Goods: ship-to first; services: bill-to first
  if (!input.isServiceDocument) {
    const ship =
      labelledCode(input.shipToStateCode) ??
      labelledCode(input.shipToState)
    if (ship) {
      return {
        placeOfSupplyStateCode: ship.c,
        placeOfSupplyLabel: ship.label,
        source: 'SHIP_TO',
        warnings,
      }
    }
  } else {
    const bill =
      labelledCode(input.billToStateCode) ?? labelledCode(input.billToState)
    if (bill) {
      return {
        placeOfSupplyStateCode: bill.c,
        placeOfSupplyLabel: bill.label,
        source: 'BILL_TO',
        warnings,
      }
    }
  }

  // Customer GST registration (GSTIN prefix) before bare master state
  const fromGstin = code(input.customerGstin)
  if (fromGstin) {
    return {
      placeOfSupplyStateCode: fromGstin,
      placeOfSupplyLabel: fromGstin,
      source: 'CUSTOMER_GSTIN',
      warnings,
    }
  }

  if (!input.isServiceDocument) {
    const bill =
      labelledCode(input.billToStateCode) ?? labelledCode(input.billToState)
    if (bill) {
      return {
        placeOfSupplyStateCode: bill.c,
        placeOfSupplyLabel: bill.label,
        source: 'BILL_TO',
        warnings,
      }
    }
  } else {
    const ship =
      labelledCode(input.shipToStateCode) ?? labelledCode(input.shipToState)
    if (ship) {
      return {
        placeOfSupplyStateCode: ship.c,
        placeOfSupplyLabel: ship.label,
        source: 'SHIP_TO',
        warnings,
      }
    }
  }

  const customerMaster = labelledCode(input.customerState)
  if (customerMaster) {
    return {
      placeOfSupplyStateCode: customerMaster.c,
      placeOfSupplyLabel: customerMaster.label,
      source: 'CUSTOMER',
      warnings,
    }
  }

  warnings.push(
    'Place of Supply could not be determined. Complete customer or delivery tax details before posting.',
  )
  return {
    placeOfSupplyStateCode: null,
    placeOfSupplyLabel: null,
    source: 'UNRESOLVED',
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

export function formatTaxSchemeLabel(s: CommercialGstScheme | string): string {
  if (s === 'igst') return 'IGST'
  if (s === 'utgst_pair' || s === 'cgst_utgst') return 'CGST + UTGST'
  if (s === 'cgst_sgst') return 'CGST + SGST'
  return 'Unresolved'
}

export function formatPlaceOfSupplySourceLabel(source: CommercialPlaceOfSupplySource): string {
  switch (source) {
    case 'OVERRIDE':
      return 'Authorised override'
    case 'SHIP_TO':
      return 'Delivery / ship-to address'
    case 'BILL_TO':
      return 'Bill-to address'
    case 'CUSTOMER_GSTIN':
      return 'Customer GST registration'
    case 'CUSTOMER':
      return 'Customer master state'
    case 'UNRESOLVED':
      return 'Not resolved'
    default:
      return 'Auto'
  }
}
