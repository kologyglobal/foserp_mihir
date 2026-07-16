import { Clock } from 'lucide-react'
import { LedgerDrawerShell } from './LedgerDrawerShell'
import { formatDateTime } from '@/utils/dates/format'
import type { LedgerEntryAuditEvent } from '@/types/ledgerEntries'
import { cn } from '@/utils/cn'

export function LedgerAuditDrawer({
  open,
  onClose,
  entryNumber,
  events,
}: {
  open: boolean
  onClose: () => void
  entryNumber: string
  events: LedgerEntryAuditEvent[]
}) {
  return (
    <LedgerDrawerShell
      open={open}
      onClose={onClose}
      title="Audit trail"
      subtitle={entryNumber}
      widthClassName="max-w-md"
    >
      {events.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">No audit events recorded for this entry.</p>
      ) : (
        <ol className="relative space-y-0 border-l border-erp-border pl-4">
          {events.map((event, index) => (
            <li key={event.id} className={cn('relative pb-5', index === events.length - 1 && 'pb-0')}>
              <span className="absolute -left-[21px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-erp-border bg-white">
                <span className="h-1.5 w-1.5 rounded-full bg-erp-primary" />
              </span>
              <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-erp-text">{event.action}</p>
                  {event.status ? (
                    <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-erp-muted ring-1 ring-erp-border">
                      {event.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-erp-muted">
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatDateTime(event.at)} · {event.user}
                </p>
                {event.reference ? (
                  <p className="mt-1 font-mono text-[11px] text-erp-muted">Ref: {event.reference}</p>
                ) : null}
                {event.comment ? <p className="mt-2 text-[12px] text-erp-text">{event.comment}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </LedgerDrawerShell>
  )
}
