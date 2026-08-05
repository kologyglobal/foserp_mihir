/**
 * Pure RCM lifecycle helpers (Phase 4).
 * Incomplete AP RCM account setup → RCM_ACCOUNTING_PENDING block (never silent post).
 */
import type { GstRcmLifecycleStatus } from '@prisma/client'

export const RCM_ACCOUNTING_PENDING_CODE = 'RCM_ACCOUNTING_PENDING' as const
export const VENDOR_INVOICE_RCM_ACCOUNTING_PENDING = 'VENDOR_INVOICE_RCM_ACCOUNTING_PENDING' as const

export const RCM_PAYABLE_COMPONENTS = [
  'RCM_CGST_PAYABLE',
  'RCM_SGST_PAYABLE',
  'RCM_IGST_PAYABLE',
] as const

export type RcmPayableComponent = (typeof RCM_PAYABLE_COMPONENTS)[number]

export function isRcmPayableComponent(component: string): component is RcmPayableComponent {
  return (RCM_PAYABLE_COMPONENTS as readonly string[]).includes(component)
}

/** Issue payload when RCM payable GL accounts are missing. */
export function rcmAccountingPendingIssue(component: string): { code: string; message: string } {
  return {
    code: VENDOR_INVOICE_RCM_ACCOUNTING_PENDING,
    message: `RCM accounting incomplete (${RCM_ACCOUNTING_PENDING_CODE}): map default key for ${component} (GST_RCM_*_PAYABLE) or set an account override before post`,
  }
}

export type RcmTransitionAction = 'MARK_LIABILITY_PAID' | 'RECOGNIZE_ITC' | 'MARK_NOT_CLAIMABLE' | 'VOID'

const ALLOWED: Record<RcmTransitionAction, readonly GstRcmLifecycleStatus[]> = {
  MARK_LIABILITY_PAID: ['LIABILITY_POSTED'],
  RECOGNIZE_ITC: ['LIABILITY_PAID'],
  MARK_NOT_CLAIMABLE: ['LIABILITY_POSTED', 'LIABILITY_PAID'],
  VOID: ['LIABILITY_POSTED', 'LIABILITY_PAID', 'ITC_RECOGNIZED', 'ITC_NOT_CLAIMABLE'],
}

export function canTransitionRcmStatus(
  current: GstRcmLifecycleStatus,
  action: RcmTransitionAction,
): boolean {
  return ALLOWED[action].includes(current)
}

export function nextRcmStatus(action: RcmTransitionAction): GstRcmLifecycleStatus {
  switch (action) {
    case 'MARK_LIABILITY_PAID':
      return 'LIABILITY_PAID'
    case 'RECOGNIZE_ITC':
      return 'ITC_RECOGNIZED'
    case 'MARK_NOT_CLAIMABLE':
      return 'ITC_NOT_CLAIMABLE'
    case 'VOID':
      return 'VOID'
  }
}

/**
 * Suggest compliance ITC gate for RCM — never auto-eligible without liability payment.
 */
export function rcmItcGateNote(input: {
  status: GstRcmLifecycleStatus
  itcEligibility?: string | null
  glInputTaxBookedAtPost?: boolean
}): { claimBlocked: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (input.itcEligibility === 'INELIGIBLE') {
    return { claimBlocked: true, reasons: ['Books ITC marked INELIGIBLE'] }
  }
  if (input.status === 'VOID') {
    return { claimBlocked: true, reasons: ['RCM register entry is VOID'] }
  }
  if (input.status === 'ITC_NOT_CLAIMABLE') {
    return { claimBlocked: true, reasons: ['Marked ITC_NOT_CLAIMABLE'] }
  }
  if (input.status === 'LIABILITY_POSTED') {
    reasons.push('RCM liability payment not confirmed — statutory ITC claim gated')
  }
  if (input.status === 'LIABILITY_PAID') {
    reasons.push('Liability paid — ready for explicit ITC recognition (not automatic)')
  }
  if (input.status === 'ITC_RECOGNIZED') {
    reasons.push('ITC already marked recognized on register')
  }
  if (input.glInputTaxBookedAtPost) {
    reasons.push(
      'GL may already show INPUT tax from concurrent VI post; register status is compliance gate, not re-post of input GST',
    )
  }
  const claimBlocked =
    input.status !== 'LIABILITY_PAID' && input.status !== 'ITC_RECOGNIZED'
  return { claimBlocked: claimBlocked && input.status !== 'ITC_RECOGNIZED', reasons }
}

/** True when recoverable RCM tax is positive and eligibility is not explicitly ineligible. */
export function isRcmItcClaimableEligibility(itcEligibility: string | null | undefined): boolean {
  return itcEligibility !== 'INELIGIBLE'
}
