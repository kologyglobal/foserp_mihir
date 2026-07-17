import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  PURCHASE_APPROVAL_AGEING_LABELS,
  PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS,
  PURCHASE_APPROVAL_QUEUE_TAB_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
} from '../services/purchase'
import type {
  PurchaseApprovalAgeingBucket,
  PurchaseApprovalDocumentType,
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
  PurchaseRequisitionPriority,
} from '../types/purchaseDomain'

export interface ApprovalListFilters {
  search: string
  /** Queue view — formerly the Approvals tab strip */
  queue: string
  documentType: string
  requester: string
  department: string
  locationId: string
  amountMin: string
  amountMax: string
  submittedFrom: string
  submittedTo: string
  priority: string
  /** Domain ageing bucket, or `overdue` (≥8 pending days) for KPI deep-link. */
  ageing: string
}

export const DEFAULT_APPROVAL_LIST_FILTERS: ApprovalListFilters = {
  search: '',
  /** Empty = Pending My Approval (default queue; not counted as an active filter chip) */
  queue: '',
  documentType: '',
  requester: '',
  department: '',
  locationId: '',
  amountMin: '',
  amountMax: '',
  submittedFrom: '',
  submittedTo: '',
  priority: '',
  ageing: '',
}

export type ApprovalSortKey =
  | 'submittedDate'
  | 'documentNumber'
  | 'amount'
  | 'pendingSinceDays'
  | 'priority'
  | 'status'

export const APPROVAL_SORT_OPTIONS: { value: ApprovalSortKey; label: string }[] = [
  { value: 'submittedDate', label: 'Sort: Submitted' },
  { value: 'documentNumber', label: 'Sort: Document No.' },
  { value: 'amount', label: 'Sort: Amount' },
  { value: 'pendingSinceDays', label: 'Sort: Pending Age' },
  { value: 'priority', label: 'Sort: Priority' },
  { value: 'status', label: 'Sort: Status' },
]

function approvalMatchesAgeing(days: number, ageing: string): boolean {
  if (!ageing) return true
  if (ageing === 'overdue') return days >= 8
  if (ageing === '0_3') return days <= 3
  if (ageing === '4_7') return days >= 4 && days <= 7
  if (ageing === '8_15') return days >= 8 && days <= 15
  if (ageing === '16_plus') return days >= 16
  return true
}

export function buildApprovalFilterFields(input: {
  departmentOptions: string[]
  locationOptions: { id: string; name: string }[]
}): CrmFilterField[] {
  return [
    { type: 'section', label: 'Queue' },
    {
      type: 'select',
      key: 'queue',
      label: 'Approval queue',
      options: [
        { value: '', label: PURCHASE_APPROVAL_QUEUE_TAB_LABELS.pending_mine },
        ...(
          ['approved_by_me', 'rejected_by_me', 'all_history'] as PurchaseApprovalQueueTab[]
        ).map((value) => ({
          value,
          label: PURCHASE_APPROVAL_QUEUE_TAB_LABELS[value],
        })),
      ],
    },
    { type: 'section', label: 'Status & parties' },
    {
      type: 'select',
      key: 'documentType',
      label: 'Document Type',
      options: Object.entries(PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'search-select',
      key: 'department',
      label: 'Department',
      options: input.departmentOptions.map((d) => ({ value: d, label: d })),
      placeholder: 'Search department…',
    },
    {
      type: 'search-select',
      key: 'locationId',
      label: 'Location',
      options: input.locationOptions.map((l) => ({ value: l.id, label: l.name })),
      placeholder: 'Search location…',
    },
    {
      type: 'select',
      key: 'priority',
      label: 'Priority',
      options: Object.entries(PURCHASE_REQUISITION_PRIORITY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'ageing',
      label: 'Ageing',
      options: [
        ...Object.entries(PURCHASE_APPROVAL_AGEING_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        { value: 'overdue', label: 'Overdue (8+ days)' },
      ],
    },
    {
      type: 'number-range',
      label: 'Amount',
      minKey: 'amountMin',
      maxKey: 'amountMax',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
    },
    {
      type: 'date-range',
      label: 'Submitted',
      fromKey: 'submittedFrom',
      toKey: 'submittedTo',
      presets: true,
    },
  ]
}

export function approvalFiltersToCrmValues(filters: ApprovalListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToApprovalFilters(values: CrmFilterValues): ApprovalListFilters {
  const str = (key: keyof ApprovalListFilters) => {
    const v = values[key]
    return typeof v === 'string' ? v : ''
  }
  return {
    search: str('search'),
    queue: str('queue'),
    documentType: str('documentType'),
    requester: str('requester'),
    department: str('department'),
    locationId: str('locationId'),
    amountMin: str('amountMin'),
    amountMax: str('amountMax'),
    submittedFrom: str('submittedFrom'),
    submittedTo: str('submittedTo'),
    priority: str('priority'),
    ageing: str('ageing'),
  }
}

export function resolveApprovalQueueTab(queue: string): PurchaseApprovalQueueTab {
  if (queue === 'approved_by_me' || queue === 'rejected_by_me' || queue === 'all_history') {
    return queue
  }
  return 'pending_mine'
}

export function hasActiveApprovalFilters(filters: ApprovalListFilters): boolean {
  return (
    Object.entries(filters).some(([key, value]) => key !== 'search' && Boolean(value)) ||
    Boolean(filters.search.trim())
  )
}

export function approvalFilterChipLabelResolver(
  key: string,
  value: string,
  lookups?: { locations?: { id: string; name: string }[] },
): string | undefined {
  if (key === 'queue') {
    return PURCHASE_APPROVAL_QUEUE_TAB_LABELS[resolveApprovalQueueTab(value)]
  }
  if (key === 'documentType') {
    return (
      PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS[value as PurchaseApprovalDocumentType] ?? value
    )
  }
  if (key === 'priority') {
    return PURCHASE_REQUISITION_PRIORITY_LABELS[value as PurchaseRequisitionPriority] ?? value
  }
  if (key === 'ageing') {
    if (value === 'overdue') return 'Overdue (8+ days)'
    return PURCHASE_APPROVAL_AGEING_LABELS[value as Exclude<PurchaseApprovalAgeingBucket, ''>] ?? value
  }
  if (key === 'locationId') {
    return lookups?.locations?.find((l) => l.id === value)?.name ?? value
  }
  return undefined
}

export function filterApprovalRows(
  rows: PurchaseApprovalQueueRow[],
  filters: ApprovalListFilters,
): PurchaseApprovalQueueRow[] {
  const q = filters.search.trim().toLowerCase()
  const amountMin = filters.amountMin ? Number(filters.amountMin) : null
  const amountMax = filters.amountMax ? Number(filters.amountMax) : null

  return rows.filter((r) => {
    if (q) {
      const hay = [
        r.documentNumber,
        r.documentTypeLabel,
        r.requestedBy,
        r.department,
        r.locationName,
        r.statusLabel,
        r.priorityLabel,
        r.approverName,
        r.approvalLevelLabel,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.documentType && r.documentType !== filters.documentType) return false
    if (
      filters.requester &&
      !r.requestedBy.toLowerCase().includes(filters.requester.trim().toLowerCase())
    ) {
      return false
    }
    if (filters.department && r.department !== filters.department) return false
    if (filters.locationId && r.locationId !== filters.locationId) return false
    if (amountMin != null && Number.isFinite(amountMin) && r.amount < amountMin) return false
    if (amountMax != null && Number.isFinite(amountMax) && r.amount > amountMax) return false
    if (filters.submittedFrom && r.submittedDate.slice(0, 10) < filters.submittedFrom) return false
    if (filters.submittedTo && r.submittedDate.slice(0, 10) > filters.submittedTo) return false
    if (filters.priority && r.priority !== filters.priority) return false
    if (!approvalMatchesAgeing(r.pendingSinceDays, filters.ageing)) return false
    return true
  })
}

export function sortApprovalRows(
  rows: PurchaseApprovalQueueRow[],
  sortBy: ApprovalSortKey,
): PurchaseApprovalQueueRow[] {
  const list = [...rows]
  const cmp = (a: string | number | null | undefined, b: string | number | null | undefined) => {
    const as = a == null ? '' : String(a)
    const bs = b == null ? '' : String(b)
    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
  }
  switch (sortBy) {
    case 'documentNumber':
      return list.sort((a, b) => cmp(a.documentNumber, b.documentNumber))
    case 'amount':
      return list.sort((a, b) => b.amount - a.amount)
    case 'pendingSinceDays':
      return list.sort((a, b) => b.pendingSinceDays - a.pendingSinceDays)
    case 'priority':
      return list.sort((a, b) => cmp(a.priority, b.priority))
    case 'status':
      return list.sort((a, b) => cmp(a.statusLabel, b.statusLabel))
    case 'submittedDate':
    default:
      return list.sort(
        (a, b) =>
          cmp(b.submittedDate, a.submittedDate) || cmp(b.documentNumber, a.documentNumber),
      )
  }
}
