/**
 * Phase 7C5 — Dispatch posting policy + feature flag.
 * Policy defaults are pilot-safe; override later via tenant settings table if needed.
 */
import { env } from '../../../config/env.js'

export type DispatchPostingPolicy = {
  requireReservationBeforePosting: boolean
  requirePickBeforePosting: boolean
  requirePackBeforePosting: boolean
  requireIssuedChallanBeforePosting: boolean
  requireQualityClearance: boolean
  allowPartialDispatch: boolean
  allowOverDispatch: boolean
  allowNegativeStock: boolean
  requireSerialAllocation: boolean
  requireLotAllocation: boolean
  requireSupervisorApprovalForOverride: boolean
  allowDirectEmergencyDispatch: boolean
  reversalApprovalRequired: boolean
  blockReversalWhenInvoiced: boolean
  blockReversalWhenCogsPosted: boolean
  /** When true, invoice-ready / auto SI wait until POD is DELIVERED or PARTIALLY_DELIVERED. */
  requirePodBeforeInvoice: boolean
}

/** Pilot defaults (§6). */
export const DISPATCH_POSTING_POLICY_DEFAULTS: DispatchPostingPolicy = {
  requireReservationBeforePosting: true,
  requirePickBeforePosting: true,
  requirePackBeforePosting: true,
  requireIssuedChallanBeforePosting: true,
  requireQualityClearance: true,
  allowPartialDispatch: true,
  allowOverDispatch: false,
  allowNegativeStock: false,
  requireSerialAllocation: false,
  requireLotAllocation: false,
  requireSupervisorApprovalForOverride: true,
  allowDirectEmergencyDispatch: false,
  reversalApprovalRequired: true,
  blockReversalWhenInvoiced: true,
  blockReversalWhenCogsPosted: true,
  requirePodBeforeInvoice: false,
}

/**
 * Soft legacy policy used when hardened posting is OFF, or for BASIC_7C0
 * confirm when hardened is ON but document is classified legacy.
 */
export const DISPATCH_POSTING_POLICY_LEGACY_SOFT: DispatchPostingPolicy = {
  ...DISPATCH_POSTING_POLICY_DEFAULTS,
  requireReservationBeforePosting: false,
  requirePickBeforePosting: false,
  requirePackBeforePosting: false,
  requireIssuedChallanBeforePosting: false,
  requireQualityClearance: false,
}

/**
 * Emergency override policy — skips operational document gates (reserve/pick/pack/challan/QC).
 * Serial/lot requirements from the base policy are preserved.
 */
export function buildEmergencyDispatchPolicy(base: DispatchPostingPolicy): DispatchPostingPolicy {
  return {
    ...base,
    requireReservationBeforePosting: false,
    requirePickBeforePosting: false,
    requirePackBeforePosting: false,
    requireIssuedChallanBeforePosting: false,
    requireQualityClearance: false,
    allowDirectEmergencyDispatch: true,
  }
}

export function isDispatchHardenedPostingEnabled(): boolean {
  return Boolean(env.DISPATCH_HARDENED_POSTING_ENABLED)
}

export function getDispatchPostingPolicy(options?: {
  planningSource?: string | null
  forceHardened?: boolean
}): DispatchPostingPolicy {
  const hardened =
    options?.forceHardened === true ||
    (isDispatchHardenedPostingEnabled() && options?.planningSource === 'WORKBENCH_7C1')

  if (!hardened) {
    return {
      ...DISPATCH_POSTING_POLICY_LEGACY_SOFT,
      requirePodBeforeInvoice: Boolean(env.REQUIRE_POD_BEFORE_INVOICE),
    }
  }
  return {
    ...DISPATCH_POSTING_POLICY_DEFAULTS,
    requirePodBeforeInvoice:
      Boolean(env.REQUIRE_POD_BEFORE_INVOICE) || DISPATCH_POSTING_POLICY_DEFAULTS.requirePodBeforeInvoice,
  }
}
