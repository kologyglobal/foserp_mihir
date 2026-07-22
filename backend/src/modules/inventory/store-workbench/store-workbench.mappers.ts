import type {
  DispatchReadinessStatus,
  InventoryAdjustmentStatus,
  InventoryStockCountStatus,
  InventoryTransferStatus,
} from '@prisma/client'

/** Domains surfaced by the aggregated Inventory Store Workbench (live projections only). */
export const NEEDS_ACTION_DOMAINS = [
  'manufacturing',
  'purchase',
  'dispatch',
  'transfers',
  'stock-counts',
  'adjustments',
  'reconciliation',
  'exceptions',
] as const

export type NeedsActionDomain = (typeof NEEDS_ACTION_DOMAINS)[number]

export type NeedsActionSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

/**
 * Normalized needs-action row. `key` is a stable deterministic identifier
 * (`DOMAIN:CATEGORY:sourceId[...]`) so clients can ack/diff rows across refreshes —
 * rows are never persisted server-side.
 */
export interface NeedsActionRow {
  key: string
  domain: NeedsActionDomain
  category: string
  severity: NeedsActionSeverity
  title: string
  detail: string
  source: { type: string; id: string; number?: string | null }
  deepLink: string | null
  quantity: string | null
  asOf: string
}

export function needsActionKey(
  domain: NeedsActionDomain,
  category: string,
  ...idParts: Array<string | null | undefined>
): string {
  const suffix = idParts.filter((part): part is string => Boolean(part)).join(':')
  return `${domain.toUpperCase()}:${category}:${suffix}`
}

/** Transfer statuses that still require a store action, mapped to a queue category. */
export function transferNeedsActionCategory(
  status: InventoryTransferStatus,
): { category: string; severity: NeedsActionSeverity; action: string } | null {
  switch (status) {
    case 'SUBMITTED':
      return { category: 'TRANSFER_APPROVAL_PENDING', severity: 'WARNING', action: 'Approve or reject transfer' }
    case 'APPROVED':
      return { category: 'TRANSFER_DISPATCH_PENDING', severity: 'WARNING', action: 'Dispatch approved transfer' }
    case 'IN_TRANSIT':
      return { category: 'TRANSFER_RECEIPT_PENDING', severity: 'WARNING', action: 'Receive in-transit stock' }
    case 'PARTIALLY_RECEIVED':
      return { category: 'TRANSFER_RECEIPT_PENDING', severity: 'WARNING', action: 'Receive remaining in-transit stock' }
    default:
      return null
  }
}

export function stockCountNeedsActionCategory(
  status: InventoryStockCountStatus,
): { category: string; severity: NeedsActionSeverity; action: string } | null {
  switch (status) {
    case 'SNAPSHOTTED':
    case 'COUNTING':
      return { category: 'STOCK_COUNT_ENTRY_PENDING', severity: 'INFO', action: 'Enter counted quantities' }
    case 'SUBMITTED':
      return { category: 'STOCK_COUNT_APPROVAL_PENDING', severity: 'WARNING', action: 'Approve stock count' }
    case 'APPROVED':
      return { category: 'STOCK_COUNT_POSTING_PENDING', severity: 'WARNING', action: 'Post approved stock count' }
    default:
      return null
  }
}

export function adjustmentNeedsActionCategory(
  status: InventoryAdjustmentStatus,
): { category: string; severity: NeedsActionSeverity; action: string } | null {
  switch (status) {
    case 'SUBMITTED':
      return { category: 'ADJUSTMENT_APPROVAL_PENDING', severity: 'WARNING', action: 'Approve adjustment' }
    case 'APPROVED':
      return { category: 'ADJUSTMENT_POSTING_PENDING', severity: 'WARNING', action: 'Post approved adjustment' }
    default:
      return null
  }
}

/** Readiness statuses that block dispatch and therefore need store/planner action. */
export function dispatchReadinessSeverity(
  readinessStatus: DispatchReadinessStatus,
): NeedsActionSeverity | null {
  switch (readinessStatus) {
    case 'BLOCKED':
    case 'RECONCILIATION_REQUIRED':
      return 'CRITICAL'
    case 'NOT_READY':
    case 'WAITING_FOR_PRODUCTION':
    case 'WAITING_FOR_QUALITY':
    case 'WAITING_FOR_STOCK':
    case 'ON_HOLD':
      return 'WARNING'
    case 'PARTIALLY_READY':
      return 'INFO'
    default:
      return null
  }
}
