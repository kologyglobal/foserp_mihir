import type { GstScheme } from '../types/invoice'
import { COMPANY_GSTIN, COMPANY_STATE } from '../types/invoice'
import {
  formatPlaceOfSupplyLabel,
  resolveGstStateCode,
} from './gstStateCode'

export type GstSupplyContext = {
  isInterstate: boolean
  gstScheme: GstScheme
  placeOfSupplyStateCode: string | null
  placeOfSupplyLabel: string
}

export function resolvePartyStateCode(opts: {
  state?: string | null
  stateCode?: string | null
  gstin?: string | null
}): string | null {
  return (
    resolveGstStateCode(opts.stateCode) ??
    resolveGstStateCode(opts.state) ??
    resolveGstStateCode(opts.gstin)
  )
}

/** Place of supply from billing address / explicit POS / GSTIN. */
export function resolvePlaceOfSupplyFromBilling(opts: {
  explicitPlaceOfSupply?: string | null
  billingState?: string | null
  billingStateCode?: string | null
  gstin?: string | null
}): string | null {
  return (
    resolveGstStateCode(opts.explicitPlaceOfSupply) ??
    resolveGstStateCode(opts.billingStateCode) ??
    resolveGstStateCode(opts.billingState) ??
    resolveGstStateCode(opts.gstin)
  )
}

/**
 * Purchase (AP): inter-state when supplier registered state ≠ place of supply (buyer receiving / billing).
 * Matches PO editor intent and vendor invoice POS vs supplier state.
 */
export function determinePurchaseGstSupply(opts: {
  supplierState?: string | null
  supplierStateCode?: string | null
  supplierGstin?: string | null
  placeOfSupply?: string | null
  defaultPlaceOfSupplyState?: string | null
  defaultPlaceOfSupplyStateCode?: string | null
}): GstSupplyContext {
  const supplierCode = resolvePartyStateCode({
    state: opts.supplierState,
    stateCode: opts.supplierStateCode,
    gstin: opts.supplierGstin,
  })

  const posCode =
    resolvePlaceOfSupplyFromBilling({
      explicitPlaceOfSupply: opts.placeOfSupply,
      billingState: opts.defaultPlaceOfSupplyState,
      billingStateCode: opts.defaultPlaceOfSupplyStateCode,
    }) ?? supplierCode

  const isInterstate =
    supplierCode != null && posCode != null ? supplierCode !== posCode : false

  const placeOfSupplyLabel =
    opts.placeOfSupply?.trim() ||
    formatPlaceOfSupplyLabel(posCode, opts.defaultPlaceOfSupplyState)

  return {
    isInterstate,
    gstScheme: isInterstate ? 'igst' : 'cgst_sgst',
    placeOfSupplyStateCode: posCode,
    placeOfSupplyLabel,
  }
}

/**
 * Sales (AR / CRM): inter-state when company billing state ≠ customer billing / place of supply.
 */
export function determineSalesGstSupply(opts: {
  companyState?: string | null
  companyStateCode?: string | null
  companyGstin?: string | null
  customerPlaceOfSupply?: string | null
  customerState?: string | null
  customerGstin?: string | null
}): GstSupplyContext {
  const companyCode =
    resolvePartyStateCode({
      state: opts.companyState,
      stateCode: opts.companyStateCode,
      gstin: opts.companyGstin ?? COMPANY_GSTIN,
    }) ?? resolveGstStateCode(COMPANY_STATE)

  const customerPosCode = resolvePlaceOfSupplyFromBilling({
    explicitPlaceOfSupply: opts.customerPlaceOfSupply,
    billingState: opts.customerState,
    gstin: opts.customerGstin,
  })

  const isInterstate =
    companyCode != null && customerPosCode != null
      ? companyCode !== customerPosCode
      : false

  return {
    isInterstate,
    gstScheme: isInterstate ? 'igst' : 'cgst_sgst',
    placeOfSupplyStateCode: customerPosCode,
    placeOfSupplyLabel: formatPlaceOfSupplyLabel(customerPosCode, opts.customerState),
  }
}

/** @deprecated Prefer determineSalesGstSupply with explicit company state from setup / legal entity. */
export function deriveIsInterstateFromStates(
  counterpartyState: string,
  placeOfSupply: string,
  fallback = false,
): boolean {
  const a = resolveGstStateCode(counterpartyState)
  const b = resolveGstStateCode(placeOfSupply)
  if (!a || !b) return fallback
  return a !== b
}
