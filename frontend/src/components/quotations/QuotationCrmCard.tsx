import { FileText, Eye, Pencil, ChevronRight, Layers, User } from 'lucide-react'
import type { QuotationDocument, QuotationDocumentStatus } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { cn } from '../../utils/cn'
import { ConvertQuotationToSOAction } from './ConvertQuotationToSOAction'
import { Select } from '../forms/Inputs'
import { RecordLink } from '../common/RecordLink'
import { entity360CustomerPath } from '../../config/entity360Routes'

export interface QuotationListItem {
  document: QuotationDocument
  quotationNo: string
  customerName: string
  customerId?: string | null
  opportunityName?: string
  revisionCount: number
  quotationDate: string
  expiryDate: string
  ownerName: string
}

function statusTone(status: QuotationDocumentStatus): 'live' | 'healthy' | 'warning' | 'critical' {
  if (status === 'approved' || status === 'converted') return 'healthy'
  if (status === 'rejected') return 'critical'
  if (status === 'pending_approval' || status === 'draft') return 'warning'
  return 'live'
}

function statusLabel(status: QuotationDocumentStatus) {
  return status.replace(/_/g, ' ')
}

export function QuotationCrmCard({ item }: { item: QuotationListItem }) {
  const { document: d, quotationNo, customerName, customerId, opportunityName, revisionCount } = item
  const detailPath = `/crm/quotations/${d.quotationId}`

  return (
    <article
      className={cn(
        'group flex flex-col rounded-xl border border-erp-border bg-erp-surface',
        'shadow-[var(--erp-shadow-card)] transition-all hover:border-erp-primary/25 hover:shadow-md',
        d.status === 'pending_approval' && 'border-erp-warning/40 ring-1 ring-erp-warning/10',
        d.locked && 'opacity-95',
      )}
    >
      <div className="border-b border-erp-border/60 bg-gradient-to-r from-erp-primary/[0.04] to-transparent px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <RecordLink to={detailPath} className="font-mono text-[13px] font-bold">
              {quotationNo}
            </RecordLink>
            <p className="mt-0.5 truncate text-[12px] font-medium text-erp-text">
              {customerId ? (
                <RecordLink to={entity360CustomerPath(customerId)}>{customerName}</RecordLink>
              ) : (
                customerName
              )}
            </p>
          </div>
          <LiveStatusBadge label={statusLabel(d.status)} tone={statusTone(d.status)} pulse={false} />
        </div>
        {opportunityName ? (
          <p className="mt-1 truncate text-[11px] text-erp-muted">{opportunityName}</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Total value</p>
            <p className="text-xl font-bold tabular-nums text-erp-text">{formatCrmCurrency(d.totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Revision</p>
            <p className="text-lg font-bold tabular-nums text-erp-text">R{d.revisionNo}</p>
            {revisionCount > 1 ? (
              <p className="text-[10px] text-erp-muted">{revisionCount} versions</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-erp-muted">
          {d.salesOwnerName ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {d.salesOwnerName}
            </span>
          ) : null}
          {d.locked ? (
            <span className="rounded bg-erp-surface-alt px-1.5 py-0.5 font-semibold uppercase text-[9px]">Locked</span>
          ) : null}
          {d.salesOrderNo ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-[9px] text-emerald-700">
              SO: {d.salesOrderNo}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {d.sections.length} sections
          </span>
        </div>

        <div className="crm-card-footer">
          <RecordLink
            to={`/crm/quotations/${d.quotationId}/editor?doc=${d.id}`}
            className="crm-card-action"
          >
            <Pencil className="h-3 w-3" />
            Editor
          </RecordLink>
          <RecordLink
            to={`/crm/quotations/${d.quotationId}/preview?doc=${d.id}`}
            className="crm-card-action"
          >
            <Eye className="h-3 w-3" />
            Preview
          </RecordLink>
          <div>
            <ConvertQuotationToSOAction documentId={d.id} variant="card-action" />
          </div>
          <RecordLink to={detailPath} className="crm-card-footer-cta">
            Open
            <ChevronRight className="h-3.5 w-3.5" />
          </RecordLink>
        </div>
      </div>
    </article>
  )
}

export function QuotationCrmList({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
}

export function QuotationCrmEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-erp-border bg-erp-surface-alt/30 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-erp-primary-soft">
        <FileText className="h-5 w-5 text-erp-primary" />
      </div>
      <p className="text-sm font-semibold text-erp-text">No quotations match your filters</p>
      <p className="mt-1 max-w-sm text-[13px] text-erp-muted">
        Create a new quotation from an opportunity or clear filters to see all documents.
      </p>
      {onClear ? (
        <button
          type="button"
          className="mt-4 rounded-md bg-erp-primary px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}

export function QuotationPortfolioToolbar({
  count,
  total,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  segment,
  onSegmentChange,
}: {
  count: number
  total: number
  viewMode: 'card' | 'list'
  onViewModeChange: (mode: 'card' | 'list') => void
  sortBy: 'value' | 'revision' | 'status'
  onSortChange: (sort: 'value' | 'revision' | 'status') => void
  segment: 'all' | 'pending' | 'draft' | 'approved'
  onSegmentChange: (segment: 'all' | 'pending' | 'draft' | 'approved') => void
}) {
  const segments: { id: typeof segment; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending approval' },
    { id: 'draft', label: 'Drafts' },
    { id: 'approved', label: 'Approved' },
  ]

  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-erp-muted">
          Showing <span className="font-semibold tabular-nums text-erp-text">{count}</span> of {total}
        </p>
        <div className="flex rounded-lg border border-erp-border bg-erp-surface-alt/50 p-0.5">
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSegmentChange(s.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                segment === s.id ? 'bg-erp-surface text-erp-primary shadow-sm' : 'text-erp-text hover:bg-erp-surface-alt',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-erp-muted">
          Sort
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'value' | 'revision' | 'status')}
            className="h-8 min-w-[110px] py-0 text-[12px]"
          >
            <option value="value">Value</option>
            <option value="revision">Revision</option>
            <option value="status">Status</option>
          </Select>
        </label>
        <div className="flex rounded-lg border border-erp-border p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('card')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold',
              viewMode === 'card' ? 'bg-erp-primary text-white' : 'text-erp-muted',
            )}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold',
              viewMode === 'list' ? 'bg-erp-primary text-white' : 'text-erp-muted',
            )}
          >
            Table
          </button>
        </div>
      </div>
    </div>
  )
}

export { statusTone as quotationStatusTone, statusLabel as quotationStatusLabel }
