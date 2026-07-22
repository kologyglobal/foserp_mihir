import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { sourceDocumentRoute, sourceTypeLabel } from './invoiceVariant'

export interface SourceDocumentRef {
  sourceType: string
  sourceDocumentId?: string | null
  /** Human number persisted on the document (snapshot). */
  documentNumber?: string | null
  documentDate?: string | null
}

/**
 * Source document reference card with drill-down (SO / PO / GRN).
 * Renders a plain snapshot row when the source type has no live route.
 */
export function SourceDocumentCard({ sources, emptyText }: { sources: SourceDocumentRef[]; emptyText?: string }) {
  const rows = sources.filter((s) => s.sourceType && s.sourceType !== 'DIRECT')
  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-erp-muted">
        {emptyText ?? 'Direct document — no source reference.'}
      </p>
    )
  }
  return (
    <ul className="space-y-2 text-[12px]">
      {rows.map((s, idx) => {
        const route = s.sourceDocumentId ? sourceDocumentRoute(s.sourceType, s.sourceDocumentId) : null
        return (
          <li key={`${s.sourceType}-${s.sourceDocumentId ?? idx}`} className="rounded border border-erp-border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{sourceTypeLabel(s.sourceType)}</span>
                {' — '}
                {s.documentNumber ?? s.sourceDocumentId ?? '—'}
                {s.documentDate ? <span className="ml-2 tabular-nums text-erp-muted">{s.documentDate}</span> : null}
              </span>
              {route && (
                <Link to={route} className="inline-flex items-center gap-1 text-erp-accent hover:underline">
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  Open
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
