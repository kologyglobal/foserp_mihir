import { AlertTriangle, History } from 'lucide-react'
import type { Visitor } from '../types/gate.types'
import { formatDate } from '@/utils/dates/format'
import { ErpButton } from '@/components/erp/ErpButton'

/** Repeat-visitor card shown after a successful mobile-number lookup. */
export function VisitorHistoryCard({
  visitor,
  onUsePrevious,
  onStartNew,
}: {
  visitor: Visitor
  onUsePrevious: () => void
  onStartNew: () => void
}) {
  return (
    <section className="rounded-lg border border-erp-border bg-white p-4">
      <header className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-erp-primary" aria-hidden />
        <h3 className="text-[13px] font-semibold text-erp-text">Repeat visitor found</h3>
      </header>
      {visitor.isBlacklisted ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Security warning:</strong> this visitor is blacklisted
            {visitor.blacklistReason ? ` — ${visitor.blacklistReason}` : ''}. Entry requires a blacklist override approval.
          </span>
        </div>
      ) : null}
      <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Name</dt>
          <dd className="font-semibold text-erp-text">{visitor.name}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Company</dt>
          <dd className="font-medium text-erp-text">{visitor.company ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Previous host</dt>
          <dd className="font-medium text-erp-text">{visitor.lastHost ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Previous vehicle</dt>
          <dd className="font-medium text-erp-text">{visitor.lastVehicleNumber ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Last visit</dt>
          <dd className="font-medium text-erp-text">{visitor.lastVisitAt ? formatDate(visitor.lastVisitAt) : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-erp-muted">Total visits</dt>
          <dd className="font-medium tabular-nums text-erp-text">{visitor.totalVisits}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <ErpButton size="md" onClick={onUsePrevious} disabled={visitor.isBlacklisted}>
          Use Previous Details
        </ErpButton>
        <ErpButton size="md" variant="secondary" onClick={onStartNew}>
          Start New Entry
        </ErpButton>
      </div>
    </section>
  )
}
