import { formatStatus } from '../components/ui/Badge'

/**
 * Canonical sales-order status display.
 * Store value `open` is always shown as “Draft SO” (commercial draft, not fulfilment Open).
 */
export function salesOrderStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Draft SO'
  if (status === 'open') return 'Draft SO'
  return formatStatus(status)
}

/** Token for StatusBadge / EnterpriseStatusChip tone mapping. */
export function salesOrderStatusToneKey(status: string | null | undefined): string {
  if (!status || status === 'open') return 'draft'
  return status
}
