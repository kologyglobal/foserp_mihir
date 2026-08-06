/**
 * Carry commercial GST header snapshots across SO → PI → TI (demo + API payloads).
 * Prefer saved document fields; never invent rates.
 */
import type { SalesOrder } from '../types/mrp'
import type { ProformaInvoice } from '../types/proformaInvoice'
import { isApiMode } from '../config/apiConfig'
import { resolveGstStateCode } from './gstStateCode'
import { getDemoSellerStateCode } from './sellerGstState'

/**
 * Seller state for demo GST *preview* only.
 * Prefer explicit SO/PI/TI snapshot; else demo company constants when not in API mode.
 * Never invent silent "27" as a real Legal Entity.
 */
export function resolveSellerStateForBreakdown(preferred?: string | null): string | null {
  const resolved = resolveGstStateCode(preferred)
  if (resolved) return resolved
  if (isApiMode()) return null
  return getDemoSellerStateCode()
}

/** PoS for GST scheme comparison / document display. */
export function resolvePlaceOfSupplyLabel(opts: {
  placeOfSupplyStateCode?: string | null
  placeOfSupply?: string | null
  fallbackState?: string | null
}): string {
  return (
    opts.placeOfSupplyStateCode?.trim() ||
    opts.placeOfSupply?.trim() ||
    opts.fallbackState?.trim() ||
    ''
  )
}

export function placeOfSupplyFromSalesOrder(
  so: Pick<SalesOrder, 'placeOfSupply' | 'placeOfSupplyStateCode'> | null | undefined,
  customerState: string,
): string {
  return resolvePlaceOfSupplyLabel({
    placeOfSupplyStateCode: so?.placeOfSupplyStateCode,
    placeOfSupply: so?.placeOfSupply,
    fallbackState: customerState,
  })
}

export function placeOfSupplyFromProforma(
  pi: Pick<ProformaInvoice, 'placeOfSupply' | 'customerState'> | null | undefined,
  customerState?: string,
): string {
  return resolvePlaceOfSupplyLabel({
    placeOfSupply: pi?.placeOfSupply,
    fallbackState: customerState ?? pi?.customerState ?? '',
  })
}

export function taxHeaderPayloadFromSalesOrder(
  so: Pick<
    SalesOrder,
    | 'placeOfSupply'
    | 'placeOfSupplyStateCode'
    | 'supplierStateCode'
    | 'supplyType'
    | 'gstScheme'
  > | null | undefined,
) {
  if (!so) return {}
  return {
    placeOfSupply: so.placeOfSupply ?? so.placeOfSupplyStateCode ?? null,
    placeOfSupplyStateCode: so.placeOfSupplyStateCode ?? null,
    supplierStateCode: so.supplierStateCode ?? null,
    supplyType: so.supplyType ?? null,
    gstScheme: so.gstScheme ?? null,
  }
}
