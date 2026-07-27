/**
 * Frontend mirror of backend purchase UOM conversion contract.
 * quantity = primary/stock; uomQuantity = vendor; factor = vendor units per 1 primary.
 */

export function assertValidFactor(factor: number): number {
  if (!(factor > 0)) throw new Error('uomConversionFactor must be greater than zero')
  return factor
}

export function toPrimaryQty(uomQuantity: number, factor: number): number {
  return uomQuantity / assertValidFactor(factor)
}

export function toUomQuantity(primaryQuantity: number, factor: number): number {
  return primaryQuantity * assertValidFactor(factor)
}

export function toPrimaryUnitCost(vendorUnitCost: number, factor: number): number {
  return vendorUnitCost * assertValidFactor(factor)
}

export function resolveItemConversionFactor(item: {
  baseUomId?: string | null
  purchaseUomId?: string | null
  uomConversionFactor?: number | null
  purchaseQtyPerUom?: number | null
}): number {
  const purchase = item.purchaseUomId ?? null
  const base = item.baseUomId ?? null
  if (!purchase || !base || purchase === base) return 1
  const factor = Number(item.uomConversionFactor ?? item.purchaseQtyPerUom ?? 1)
  return factor > 0 ? factor : 1
}

export function formatDualQty(opts: {
  uomQuantity: number
  quantity: number
  uomCode?: string | null
  primaryUomCode?: string | null
}): string {
  const uom = opts.uomCode?.trim() || 'UOM'
  const primary = opts.primaryUomCode?.trim() || 'NOS'
  if (uom === primary || opts.uomQuantity === opts.quantity) {
    return `${opts.quantity} ${primary}`
  }
  return `${opts.uomQuantity} ${uom} → ${opts.quantity} ${primary}`
}
