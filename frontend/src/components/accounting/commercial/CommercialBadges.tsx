import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { canCrmPermission } from '@/utils/permissions/crm'
import type { CommercialAccountingStatus } from '@/types/commercialCommitments'
import { COMMERCIAL_ACCOUNTING_STATUS_LABELS } from '@/types/commercialCommitments'

/** Permission-aware CRM document link — plain text when view denied. */
export function CrmDocumentLink({
  to,
  label,
  permission,
  className,
}: {
  to: string | null | undefined
  label: string
  permission?:
    | 'crm.lead.view'
    | 'crm.opportunity.view'
    | 'crm.quotation.view'
    | 'crm.sales_order.view'
    | 'crm.company.view'
    | 'crm.customer.view'
  className?: string
}) {
  const allowed = permission ? canCrmPermission(permission) : true
  if (!to || !allowed) {
    return (
      <span
        className={cn('text-[13px] text-erp-text', className)}
        title={!allowed ? 'You do not have permission to open this CRM document.' : undefined}
      >
        {label}
      </span>
    )
  }
  return (
    <Link to={to} className={cn('text-[13px] font-medium text-erp-primary hover:underline', className)}>
      {label}
    </Link>
  )
}

export function AccountingStatusBadge({
  status,
}: {
  status: CommercialAccountingStatus
}) {
  const tone =
    status === 'posted'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'invoice_pending'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : status === 'posting_not_available'
          ? 'bg-slate-100 text-slate-700 border-slate-200'
          : 'bg-slate-50 text-slate-700 border-slate-200'
  return (
    <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold', tone)}>
      {COMMERCIAL_ACCOUNTING_STATUS_LABELS[status]}
    </span>
  )
}

export function CommercialAccountingExplanation({ dense }: { dense?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'rounded border border-slate-200 bg-slate-50 text-slate-800',
        dense ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-[12px]',
      )}
    >
      <span className="font-semibold">Commercial document only.</span> This record has not created accounting
      entries. Customer receivable, revenue and GST appear only after Sales Invoice posting (deferred).
    </div>
  )
}

export function QuotationRevisionBadge({
  revision,
  isLatest,
  superseded,
}: {
  revision: number | null | undefined
  isLatest?: boolean
  superseded?: boolean
}) {
  if (revision == null) return <span className="text-erp-muted">—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
        Rev {revision}
      </span>
      {superseded || !isLatest ? (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          Superseded
        </span>
      ) : (
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Latest</span>
      )}
    </span>
  )
}

export function QuotationApprovalSummary({
  headerStatus,
  documentStatus,
  customerApproval,
  validityExpired,
}: {
  headerStatus?: string | null
  documentStatus?: string | null
  customerApproval?: string | null
  validityExpired?: boolean
}) {
  const fullyAccepted =
    headerStatus === 'approved' && documentStatus === 'approved' && customerApproval === 'approved'
  return (
    <div className="flex flex-wrap gap-1 text-[11px]">
      <span className="rounded border border-erp-border px-1.5 py-0.5">Header: {headerStatus ?? '—'}</span>
      <span className="rounded border border-erp-border px-1.5 py-0.5">Document: {documentStatus ?? '—'}</span>
      <span className="rounded border border-erp-border px-1.5 py-0.5">
        Customer: {customerApproval ?? '—'}
      </span>
      {fullyAccepted ? (
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">Accepted</span>
      ) : null}
      {validityExpired ? (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-900">Validity Expired</span>
      ) : null}
    </div>
  )
}

export function SalesOrderPhaseBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-erp-muted">—</span>
  const phase1 = status === 'open' || status === 'confirmed' || status === 'closed'
  const label =
    status === 'open'
      ? 'Open'
      : status === 'confirmed'
        ? 'Confirmed'
        : status === 'closed'
          ? 'Closed'
          : 'Future workflow status'
  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold',
        phase1 ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
      title={phase1 ? undefined : 'Demo / future fulfilment — not operational in Phase 1'}
    >
      {label}
    </span>
  )
}
