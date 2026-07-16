import type { StockCountLineStatus, StockCountStatus, StockCountType } from '../types/inventoryDomain'

export const STOCK_COUNT_TYPE_LABELS: Record<StockCountType, string> = {
  full_physical: 'Full Physical Verification',
  warehouse: 'Warehouse Count',
  category: 'Category Count',
  item: 'Item Count',
  bin: 'Bin Count',
  batch: 'Batch Count',
  cycle: 'Cycle Count',
}

export const STOCK_COUNT_STATUS_LABELS: Record<StockCountStatus, string> = {
  draft: 'Draft',
  counting: 'Counting',
  recount_required: 'Recount Required',
  under_review: 'Under Review',
  approved: 'Approved',
  posted: 'Posted',
  cancelled: 'Cancelled',
}

export const STOCK_COUNT_LINE_STATUS_LABELS: Record<StockCountLineStatus, string> = {
  pending: 'Pending',
  counted: 'Counted',
  variance: 'Variance',
  recount_required: 'Recount Required',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export const STOCK_COUNT_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as StockCountStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'counting', label: 'Counting', status: 'counting' as const },
  { id: 'recount_required', label: 'Recount Required', status: 'recount_required' as const },
  { id: 'under_review', label: 'Under Review', status: 'under_review' as const },
  { id: 'approved', label: 'Approved', status: 'approved' as const },
  { id: 'posted', label: 'Posted', status: 'posted' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const

export const STOCK_COUNT_WORKBENCH_STEPS = [
  { step: 1, id: 'scope', label: 'Count Scope' },
  { step: 2, id: 'snapshot', label: 'Create Snapshot' },
  { step: 3, id: 'quantity', label: 'Quantity Entry' },
  { step: 4, id: 'difference', label: 'Difference Review' },
  { step: 5, id: 'recount', label: 'Recount' },
  { step: 6, id: 'approval', label: 'Variance Approval' },
  { step: 7, id: 'preview', label: 'Adjustment Preview' },
  { step: 8, id: 'post', label: 'Post Demo' },
] as const

export function stockCountStatusTone(status: StockCountStatus): 'slate' | 'blue' | 'amber' | 'green' | 'red' {
  switch (status) {
    case 'draft':
      return 'slate'
    case 'counting':
      return 'blue'
    case 'recount_required':
    case 'under_review':
      return 'amber'
    case 'approved':
    case 'posted':
      return 'green'
    case 'cancelled':
      return 'red'
    default:
      return 'slate'
  }
}
