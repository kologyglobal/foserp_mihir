import type { ReactNode } from 'react'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { formatStatus } from '../../components/ui/Badge'
import { formatDate } from '../../utils/dates/format'
import { purchaseDocStatusLabel } from '../../utils/purchaseStatusLabels'
import { cn } from '../../utils/cn'

export function purchaseBreadcrumbs(...trail: { label: string; to?: string }[]) {
  return [{ label: 'Purchase', to: '/purchase' }, ...trail]
}

export function purchaseStatusTone(status: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (status === 'draft') return 'neutral'
  if (
    status === 'submitted' ||
    status === 'sent' ||
    status === 'pending_approval' ||
    status === 'pending_inspection' ||
    status === 'pending_qc' ||
    status === 'sent_back' ||
    status === 'partially_quoted' ||
    status === 'under_evaluation'
  ) {
    return 'warning'
  }
  if (
    status === 'approved' ||
    status === 'quoted' ||
    status === 'quotation_received' ||
    status === 'posted' ||
    status === 'accepted' ||
    status === 'released'
  ) {
    return 'success'
  }
  if (status === 'cancelled' || status === 'rejected') return 'critical'
  if (
    status === 'converted' ||
    status === 'converted_to_rfq' ||
    status === 'converted_to_po' ||
    status === 'closed' ||
    status === 'received' ||
    status === 'partial' ||
    status === 'partially_accepted'
  ) {
    return 'info'
  }
  return 'neutral'
}

export function PurchaseStatusChip({
  status,
  kind,
}: {
  status: string
  /** When set, uses canonical procurement vocabulary */
  kind?: 'pr' | 'rfq' | 'po' | 'grn' | 'quote'
}) {
  const label = kind ? purchaseDocStatusLabel(kind, status) : formatStatus(status)
  return <DynamicsStatusChip label={label} tone={purchaseStatusTone(status)} />
}

export function purchaseReadonlyValue(value: ReactNode) {
  return <span className="text-sm text-erp-text">{value}</span>
}

export function PurchaseDataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('quo-editor-price__table-wrap overflow-x-auto', className)}>
      <table className="quo-editor-price__table">{children}</table>
    </div>
  )
}

export function PurchaseTableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-start gap-2 text-sm text-erp-muted">
      {children}
    </div>
  )
}

export function PurchaseDocTimeline({
  events,
}: {
  events: { t: string; d?: string | null; u?: string | null }[]
}) {
  return (
    <ul className="col-span-2 space-y-3 text-sm">
      {events
        .filter((e) => e.d)
        .map((e) => (
          <li key={e.t} className="border-l-2 border-erp-border pl-3">
            <strong className="text-erp-text">{e.t}</strong>
            <div className="text-erp-muted">
              {formatDate(e.d!)} · {e.u ?? '—'}
            </div>
          </li>
        ))}
    </ul>
  )
}
