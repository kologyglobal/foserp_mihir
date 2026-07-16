import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LedgerDrawerShell } from './LedgerDrawerShell'
import { formatCurrency } from '@/utils/formatters/currency'
import type { LedgerEntrySourceDocument } from '@/types/ledgerEntries'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function RelatedDocumentDrawer({
  open,
  onClose,
  sourceDocument,
  entryLabel,
}: {
  open: boolean
  onClose: () => void
  sourceDocument: LedgerEntrySourceDocument | null
  entryLabel?: string
}) {
  if (!sourceDocument) {
    return (
      <LedgerDrawerShell open={open} onClose={onClose} title="Source document" subtitle={entryLabel} widthClassName="max-w-md">
        <p className="py-8 text-center text-[13px] text-erp-muted">No related source document is linked to this entry.</p>
      </LedgerDrawerShell>
    )
  }

  const hasRoute = Boolean(sourceDocument.href)

  return (
    <LedgerDrawerShell
      open={open}
      onClose={onClose}
      title="Source document"
      subtitle={entryLabel ?? sourceDocument.documentNumber}
      widthClassName="max-w-md"
      footer={
        hasRoute ? (
          <Link
            to={sourceDocument.href!}
            className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[12px] font-semibold"
            onClick={onClose}
          >
            Open document
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <p className="text-[12px] text-erp-muted">Route not yet available — document details shown for reference only.</p>
        )
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Module" value={sourceDocument.module} />
        <Field label="Document type" value={sourceDocument.documentType} />
        <Field label="Document number" value={sourceDocument.documentNumber} />
        <Field label="Document date" value={sourceDocument.documentDate} />
        <Field label="Party" value={sourceDocument.partyName ?? '—'} />
        <Field
          label="Amount"
          value={
            sourceDocument.amount != null ? (
              <span className="tabular-nums">{formatCurrency(sourceDocument.amount)}</span>
            ) : (
              '—'
            )
          }
        />
        <Field label="Status" value={sourceDocument.status} />
        <Field
          label="Navigation"
          value={
            hasRoute ? (
              <Link to={sourceDocument.href!} className="inline-flex items-center gap-1 text-erp-primary hover:underline">
                Open in module
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : (
              <span className="text-erp-muted">Route not yet available</span>
            )
          }
        />
      </dl>
    </LedgerDrawerShell>
  )
}
