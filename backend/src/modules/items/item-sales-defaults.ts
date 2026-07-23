/**
 * CRM Item Phase 2 — sales commercial defaults for MasterItem.
 * Interim pricing SoT = defaultSalesRate (not standardRate).
 */
export type ItemSalesFulfilmentMethod =
  | 'STOCK'
  | 'PURCHASE'
  | 'PRODUCTION'
  | 'SUBCONTRACT'
  | 'SERVICE'
  | 'MANUAL'

const SALES_ALLOWED_TYPES = new Set(['finished_good', 'service', 'bought_out'])
const PRODUCTION_ALLOWED_TYPES = new Set(['finished_good', 'sub_assembly'])

export function defaultSalesAllowed(itemType: string | null | undefined): boolean {
  return SALES_ALLOWED_TYPES.has(String(itemType ?? ''))
}

export function defaultProductionAllowed(itemType: string | null | undefined): boolean {
  return PRODUCTION_ALLOWED_TYPES.has(String(itemType ?? ''))
}

export function defaultFulfilmentMethod(itemType: string | null | undefined): ItemSalesFulfilmentMethod {
  switch (String(itemType ?? '')) {
    case 'finished_good':
    case 'sub_assembly':
      return 'PRODUCTION'
    case 'bought_out':
    case 'raw':
    case 'consumable':
      return 'PURCHASE'
    case 'service':
      return 'SERVICE'
    default:
      return 'MANUAL'
  }
}

/** Apply create-time sales defaults when caller omitted fields. */
export function applySalesFieldDefaults(
  data: Record<string, unknown>,
  opts: { isCreate: boolean },
): Record<string, unknown> {
  const next = { ...data }
  const itemType = next.itemType != null ? String(next.itemType) : undefined

  if (opts.isCreate) {
    if (next.salesAllowed === undefined && itemType) {
      next.salesAllowed = defaultSalesAllowed(itemType)
    }
    if (next.productionAllowed === undefined && itemType) {
      next.productionAllowed = defaultProductionAllowed(itemType)
    }
    if (next.defaultFulfilmentMethod === undefined && itemType) {
      next.defaultFulfilmentMethod = defaultFulfilmentMethod(itemType)
    }
    if (next.defaultSalesRate === undefined) next.defaultSalesRate = 0
    if (next.salesLeadDays === undefined) next.salesLeadDays = 0
  } else if (itemType && next.itemType !== undefined) {
    // When itemType changes on update and sales flags omitted, refresh defaults.
    if (next.salesAllowed === undefined && next.itemType) {
      // leave existing DB value — only set if caller also cleared intentionally via explicit fields
    }
  }

  return next
}
