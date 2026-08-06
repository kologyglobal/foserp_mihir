import type { PurchaseSetup } from '../types/purchaseDomain'
import { DEFAULT_PURCHASE_SETUP } from '../data/purchase/purchaseSetupSeed'
import { coalesceGstStateCode, formatPlaceOfSupplyLabel, resolveGstStateCode } from './gstStateCode'
import { determinePurchaseGstSupply, type GstSupplyContext } from './gstSupply'

export type PurchaseLocationGstRef = {
  state?: string | null
  city?: string | null
}

export type PurchaseVendorGstRef = {
  state?: string | null
  stateCode?: string | null
  gstin?: string | null
}

/** Resolve supplier state name + code for PO/AP GST (GSTIN prefix wins over blank stateCode). */
export function resolveVendorGstParty(
  vendor: PurchaseVendorGstRef | null | undefined,
): { state: string; stateCode: string | null } {
  const state = vendor?.state?.trim() || ''
  const stateCode = coalesceGstStateCode(vendor?.stateCode, vendor?.gstin, vendor?.state)
  return { state, stateCode }
}

export function formatVendorStateLabel(vendor: PurchaseVendorGstRef | null | undefined): string {
  const { state, stateCode } = resolveVendorGstParty(vendor)
  if (state && stateCode) return formatPlaceOfSupplyLabel(stateCode, state)
  if (state) return state
  if (stateCode) return formatPlaceOfSupplyLabel(stateCode)
  return '—'
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
  const supplier = resolveVendorGstParty(vendor)
  const gst = determinePurchaseGstSupply({
    supplierState: supplier.state,
    supplierStateCode: supplier.stateCode,
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

