/**
 * Vendor UOM ↔ primary/stock UOM conversion contract.
 *
 * Locked field names:
 * - `uomQuantity` — qty in vendor/purchase UOM
 * - `quantity` — qty in primary/base/stock UOM
 * - `uomConversionFactor` — vendor units per 1 primary unit (e.g. 3 m = 1 NOS)
 *
 * Formulas:
 * - quantity = uomQuantity / uomConversionFactor
 * - unitCostPrimary = vendorUnitCost * uomConversionFactor
 * - lineAmount = vendorUnitCost * uomQuantity (= unitCostPrimary * quantity)
 */

export class UomConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UomConversionError'
  }
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback)
  return Number.isFinite(n) ? n : fallback
}

/** Reject non-positive factors (would divide by zero / invert cost). */
export function assertValidFactor(factor: unknown): number {
  const n = asNumber(factor, NaN)
  if (!(n > 0)) {
    throw new UomConversionError('uomConversionFactor must be greater than zero')
  }
  return n
}

/** Normalize factor: same UOMs → 1; otherwise require positive. */
export function resolveUomConversionFactor(input: {
  factor?: unknown
  purchaseUomId?: string | null
  baseUomId?: string | null
}): number {
  const purchase = input.purchaseUomId ?? null
  const base = input.baseUomId ?? null
  if (!purchase || !base || purchase === base) {
    return 1
  }
  return assertValidFactor(input.factor ?? 1)
}

/** Primary (stock) qty from vendor qty. */
export function toPrimaryQty(uomQuantity: unknown, factor: unknown): number {
  const f = assertValidFactor(factor)
  const uq = asNumber(uomQuantity)
  return uq / f
}

/** Vendor qty from primary qty (display / reverse). */
export function toUomQuantity(primaryQuantity: unknown, factor: unknown): number {
  const f = assertValidFactor(factor)
  return asNumber(primaryQuantity) * f
}

/** Mirror GRN accepted/rejected base qty into commercial UOM using line factor snapshot. */
export function syncGrnAcceptedRejectedUomFromBase(
  acceptedBase: unknown,
  rejectedBase: unknown,
  factor: unknown,
): { acceptedUomQuantity: number; rejectedUomQuantity: number } {
  const f = asNumber(factor, 1)
  if (!(f > 0)) {
    return {
      acceptedUomQuantity: asNumber(acceptedBase),
      rejectedUomQuantity: asNumber(rejectedBase),
    }
  }
  return {
    acceptedUomQuantity: toUomQuantity(acceptedBase, f),
    rejectedUomQuantity: toUomQuantity(rejectedBase, f),
  }
}

/** Cost per primary unit from vendor unit cost. */
export function toPrimaryUnitCost(vendorUnitCost: unknown, factor: unknown): number {
  const f = assertValidFactor(factor)
  return asNumber(vendorUnitCost) * f
}

/** Line amount in vendor currency: rate × uomQuantity. */
export function lineAmountFromVendor(vendorUnitCost: unknown, uomQuantity: unknown): number {
  return asNumber(vendorUnitCost) * asNumber(uomQuantity)
}

/**
 * Resolve dual quantities for a document line.
 * Prefer `uomQuantity` (vendor entered). Legacy clients may send only `quantity`
 * — treated as vendor qty when factor is 1, else as primary with reverse vendor qty.
 */
export function resolveDualQuantities(input: {
  uomQuantity?: unknown
  quantity?: unknown
  uomConversionFactor?: unknown
}): {
  uomQuantity: number
  quantity: number
  uomConversionFactor: number
} {
  const factor = assertValidFactor(input.uomConversionFactor ?? 1)
  const hasUom = input.uomQuantity !== undefined && input.uomQuantity !== null && input.uomQuantity !== ''
  const hasPrimary = input.quantity !== undefined && input.quantity !== null && input.quantity !== ''

  if (hasUom) {
    const uomQuantity = asNumber(input.uomQuantity)
    return {
      uomQuantity,
      quantity: toPrimaryQty(uomQuantity, factor),
      uomConversionFactor: factor,
    }
  }

  if (hasPrimary) {
    const quantity = asNumber(input.quantity)
    if (factor === 1) {
      return { uomQuantity: quantity, quantity, uomConversionFactor: factor }
    }
    return {
      uomQuantity: toUomQuantity(quantity, factor),
      quantity,
      uomConversionFactor: factor,
    }
  }

  return { uomQuantity: 0, quantity: 0, uomConversionFactor: factor }
}
