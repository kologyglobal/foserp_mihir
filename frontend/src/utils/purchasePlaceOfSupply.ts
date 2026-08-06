import type { PurchaseSetup } from '../types/purchaseDomain'
import { formatPlaceOfSupplyLabel } from './gstStateCode'
import { determinePurchaseGstSupply, type GstSupplyContext } from './gstSupply'

export type PurchaseLocationGstRef = {
  state?: string | null
  city?: string | null
}

/** Delivery warehouse POS label — warehouse state, else Purchase Setup tax POS. */
export function purchaseDeliveryPlaceOfSupplyLabel(
  delivery: PurchaseLocationGstRef | null | undefined,
  setup: PurchaseSetup | null | undefined,
  explicitPlaceOfSupply?: string | null,
): string {
  const deliveryState = delivery?.state?.trim() || ''
  return (
    explicitPlaceOfSupply?.trim() ||
    (deliveryState ? formatPlaceOfSupplyLabel(null, deliveryState) : '') ||
    formatPlaceOfSupplyLabel(
      setup?.tax.placeOfSupplyStateCode,
      setup?.tax.placeOfSupplyState,
    )
  )
}

/** PO/AP: IGST when supplier state ≠ place of supply (delivery / setup POS). */
export function resolvePurchaseOrderGstSupply(
  vendor:
    | { state?: string | null; stateCode?: string | null; gstin?: string | null }
    | null
    | undefined,
  delivery: PurchaseLocationGstRef | null | undefined,
  setup: PurchaseSetup | null | undefined,
  /** User-typed POS override only — omit on vendor/delivery auto-recalc. */
  explicitPlaceOfSupply?: string | null,
): GstSupplyContext {
  const deliveryState = delivery?.state?.trim() || ''
  const gst = determinePurchaseGstSupply({
    supplierState: vendor?.state,
    supplierStateCode: vendor?.stateCode,
    supplierGstin: vendor?.gstin,
    placeOfSupply: explicitPlaceOfSupply?.trim() || undefined,
    defaultPlaceOfSupplyState: deliveryState || setup?.tax.placeOfSupplyState,
    defaultPlaceOfSupplyStateCode: setup?.tax.placeOfSupplyStateCode,
  })
  const autoLabel = purchaseDeliveryPlaceOfSupplyLabel(delivery, setup)
  return {
    ...gst,
    placeOfSupplyLabel: explicitPlaceOfSupply?.trim() || autoLabel || gst.placeOfSupplyLabel,
  }
}

export function purchaseSetupPlaceState(setup: PurchaseSetup | null | undefined): {
  state: string
  city: string
} {
  return {
    state: setup?.tax.placeOfSupplyState?.trim() || '',
    city: '',
  }
}
