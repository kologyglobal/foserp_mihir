import type { PurchaseSetup } from '../types/purchaseDomain'
import { DEFAULT_PURCHASE_SETUP } from '../data/purchase/purchaseSetupSeed'
import { formatPlaceOfSupplyLabel, resolveGstStateCode } from './gstStateCode'
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
  const gstDefaults = purchaseSetupGstDefaults(setup)
  return (
    explicitPlaceOfSupply?.trim() ||
    (deliveryState ? formatPlaceOfSupplyLabel(null, deliveryState) : '') ||
    formatPlaceOfSupplyLabel(
      gstDefaults.placeOfSupplyStateCode,
      gstDefaults.placeOfSupplyState,
    )
  )
}

/** Merge API setup with demo defaults so POS is never blank before/without configured tax POS. */
export function purchaseSetupGstDefaults(
  setup: PurchaseSetup | null | undefined,
): Pick<PurchaseSetup['tax'], 'placeOfSupplyState' | 'placeOfSupplyStateCode'> {
  const tax = setup?.tax
  return {
    placeOfSupplyState:
      tax?.placeOfSupplyState?.trim() ||
      DEFAULT_PURCHASE_SETUP.tax.placeOfSupplyState,
    placeOfSupplyStateCode:
      tax?.placeOfSupplyStateCode?.trim() ||
      DEFAULT_PURCHASE_SETUP.tax.placeOfSupplyStateCode,
  }
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
  const gstDefaults = purchaseSetupGstDefaults(setup)
  const gst = determinePurchaseGstSupply({
    supplierState: vendor?.state,
    supplierStateCode: vendor?.stateCode ?? resolveGstStateCode(vendor?.gstin),
    supplierGstin: vendor?.gstin,
    placeOfSupply: explicitPlaceOfSupply?.trim() || undefined,
    defaultPlaceOfSupplyState: deliveryState || gstDefaults.placeOfSupplyState,
    defaultPlaceOfSupplyStateCode: gstDefaults.placeOfSupplyStateCode,
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

