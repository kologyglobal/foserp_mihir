import { useState } from 'react'
import { ExternalLink, FileText, X } from 'lucide-react'
import { TableLink } from '../ui/AppLink'
import type { SourceDocumentRef } from '../../types/accounting'
import { formatDate } from '../../utils/dates/format'

const TYPE_LABELS: Record<SourceDocumentRef['type'], string> = {
  sales_order: 'Sales Order',
  purchase_order: 'Purchase Order',
  grn: 'Goods Receipt Note',
  dispatch: 'Dispatch',
  invoice: 'Invoice',
  quotation: 'Quotation',
  work_order: 'Work Order',
  other: 'Source Document',
}

/**
 * Renders a link to an existing route when `href` resolves to a real page.
 * Otherwise opens a lightweight mock preview drawer — avoids linking into
 * demo IDs that don't exist in other modules' stores.
 */
export function SourceDocumentLink({
  source,
  fallback = '—',
}: {
  source: SourceDocumentRef | null | undefined
  fallback?: string
}) {
  const [open, setOpen] = useState(false)
  if (!source) return <span className="text-erp-muted">{fallback}</span>

  if (source.href) {
    return (
      <TableLink to={source.href} className="inline-flex items-center gap-1">
        {source.label}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </TableLink>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-erp-primary hover:underline"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        {source.label}
      </button>
      {open ? (
        <div className="erp-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="erp-modal-panel max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-erp-text">{TYPE_LABELS[source.type]}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-erp-muted hover:text-erp-text" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-erp-muted">Document No.</dt>
                <dd className="font-mono font-medium text-erp-text">{source.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-erp-muted">Description</dt>
                <dd className="text-right text-erp-text">{source.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-erp-muted">Referenced on</dt>
                <dd className="text-erp-text">{formatDate(new Date().toISOString())}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-md bg-erp-surface-alt px-3 py-2 text-[11px] text-erp-muted">
              Demo preview — the originating module record is not yet linked to a live route in this build.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
