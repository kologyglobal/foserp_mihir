/**
 * Phase 7C5 — Dispatch posting policy + commercial O2C settings.
 * Operational gates: code defaults + hardened flag.
 * Commercial flags: tenant `DispatchSettings` (partial / multi / invoice mode / POD) with env fallback for POD.
 */
import type { DispatchInvoiceMode } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { env } from '../../../config/env.js'

export type { DispatchInvoiceMode }

export type DispatchPostingPolicy = {
  requireReservationBeforePosting: boolean
  requirePickBeforePosting: boolean
  requirePackBeforePosting: boolean
  requireIssuedChallanBeforePosting: boolean
  requireQualityClearance: boolean
  allowPartialDispatch: boolean
  /** When false, block a second open outbound for the same SO line. */
  allowMultipleDispatches: boolean
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
  /**
   * ONE_PER_DISPATCH — auto DRAFT SI per posting (subject to ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH).
   * CONSOLIDATED — auto SI off; manual Invoice Ready may span multiple dispatches.
   * MANUAL_ONLY — auto SI off; invoices only via manual create.
   */
  invoiceMode: DispatchInvoiceMode
}

/** Pilot defaults (§6). */
export const DISPATCH_POSTING_POLICY_DEFAULTS: DispatchPostingPolicy = {
  requireReservationBeforePosting: true,
  requirePickBeforePosting: true,
  requirePackBeforePosting: true,
  requireIssuedChallanBeforePosting: true,
  requireQualityClearance: true,
  allowPartialDispatch: true,
  allowMultipleDispatches: true,
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
  invoiceMode: 'ONE_PER_DISPATCH',
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

/** Sync defaults only (no tenant DB). Prefer `resolveDispatchPostingPolicy` in request paths. */
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

/** Merge tenant DispatchSettings commercial flags onto the operational base policy. */
export async function resolveDispatchPostingPolicy(
  tenantId: string,
  options?: {
    planningSource?: string | null
    forceHardened?: boolean
  },
): Promise<DispatchPostingPolicy> {
  const base = getDispatchPostingPolicy(options)
  const settings = await prisma.dispatchSettings.findUnique({ where: { tenantId } })
  if (!settings) {
    return {
      ...base,
      requirePodBeforeInvoice: Boolean(env.REQUIRE_POD_BEFORE_INVOICE) || base.requirePodBeforeInvoice,
    }
  }
  return {
    ...base,
    allowPartialDispatch: settings.allowPartialDispatch,
    allowMultipleDispatches: settings.allowMultipleDispatches,
    allowOverDispatch: settings.allowOverDispatch,
    invoiceMode: settings.invoiceMode,
    requirePodBeforeInvoice:
      Boolean(env.REQUIRE_POD_BEFORE_INVOICE) || settings.requirePodBeforeInvoice,
  }
}

export function isAutoInvoiceMode(mode: DispatchInvoiceMode): boolean {
  return mode === 'ONE_PER_DISPATCH'
}

export function allowsConsolidatedInvoice(mode: DispatchInvoiceMode): boolean {
  return mode === 'CONSOLIDATED' || mode === 'MANUAL_ONLY'
}
