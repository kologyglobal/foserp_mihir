/**
 * Emergency override — hard rules shared across modules.
 * Some blockers must NEVER be overridable (tenant, integrity, statutory, stock policy).
 */

/** Absolute never — even with *.override permission. */
export const NEVER_OVERRIDABLE_BLOCKER_CODES = [
  'TENANT_ISOLATION',
  'PERMISSION_DENIED',
  'NEGATIVE_STOCK_PROHIBITED',
  'INSUFFICIENT_STOCK', // when policy.allowNegativeStock=false (mapped below)
  'INVALID_SERIAL',
  'INVALID_LOT',
  'SERIAL_ALLOCATION_INCOMPLETE',
  'LOT_ALLOCATION_INCOMPLETE',
  'POSTED_DOCUMENT_DUPLICATION',
  'ALREADY_POSTED',
  'NOT_DRAFT',
  'ACCOUNTING_PERIOD_CLOSED',
  'MANDATORY_STATUTORY_DOCUMENT_MISSING',
  'SALES_ORDER_CANCELLED',
  'QUANTITY_ABOVE_REMAINING_ORDER',
  'DISPATCH_EXCEEDS_NET_ORDER',
  'ATOMIC_INVENTORY_POSTING_FAILED',
  'DATA_INTEGRITY_CONFLICT',
] as const

export type NeverOverridableBlockerCode = (typeof NEVER_OVERRIDABLE_BLOCKER_CODES)[number]

/**
 * Operational / logistics blockers that emergency override MAY soft-bypass
 * (document gates, deferred QC, temporary commercial hold warnings).
 */
export const OVERRIDABLE_OPERATIONAL_BLOCKER_CODES = [
  'RESERVATION_SHORTAGE',
  'RESERVATION_UNAVAILABLE',
  'PICK_INCOMPLETE',
  'PACK_INCOMPLETE',
  'CHALLAN_NOT_READY',
  'FINAL_QC_REQUIRED',
  'WAITING_FOR_QUALITY',
  'OPEN_INSPECTION',
  'OPEN_NCR',
  'STOCK_IN_QUALITY_HOLD',
  'QUALITY_DEFERRED',
  'NON_CRITICAL_DOCUMENT_WARNING',
  'TEMPORARY_COMMERCIAL_APPROVAL',
  'INTEGRATION_OUTAGE',
  'ALTERNATE_MACHINE',
  'RECONCILIATION_DIFFERENCE_APPROVED',
] as const

export type OverridableOperationalBlockerCode =
  (typeof OVERRIDABLE_OPERATIONAL_BLOCKER_CODES)[number]

const NEVER_SET = new Set<string>(NEVER_OVERRIDABLE_BLOCKER_CODES)
const OVERRIDABLE_SET = new Set<string>(OVERRIDABLE_OPERATIONAL_BLOCKER_CODES)

export function isNeverOverridableBlocker(code: string): boolean {
  return NEVER_SET.has(code)
}

export function isOperationallyOverridableBlocker(code: string): boolean {
  return OVERRIDABLE_SET.has(code)
}

export type BlockerLike = { code: string; message?: string; severity?: string }

export function classifyBlockersForEmergencyOverride(blockers: BlockerLike[]): {
  neverOverridable: BlockerLike[]
  overridable: BlockerLike[]
  unknown: BlockerLike[]
  canEmergencyOverride: boolean
} {
  const neverOverridable: BlockerLike[] = []
  const overridable: BlockerLike[] = []
  const unknown: BlockerLike[] = []
  for (const b of blockers) {
    if (isNeverOverridableBlocker(b.code)) neverOverridable.push(b)
    else if (isOperationallyOverridableBlocker(b.code)) overridable.push(b)
    else unknown.push(b)
  }
  // Unknown blockers are treated as hard (fail closed) unless explicitly allow-listed.
  const canEmergencyOverride =
    neverOverridable.length === 0 && unknown.length === 0 && overridable.length > 0
  return { neverOverridable, overridable, unknown, canEmergencyOverride }
}
