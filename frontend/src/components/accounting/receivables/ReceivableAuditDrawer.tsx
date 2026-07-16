import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { ReceivableDrawerShell } from './ReceivableDrawerShell'
import { formatDateTime } from '@/utils/dates/format'
import type { ReceivableAuditEntry } from '@/types/receivables'
import { getReceivableAuditTrail } from '@/services/accounting/receivablesService'
import { cn } from '@/utils/cn'

export function ReceivableAuditDrawer({
  open,
  onClose,
  entityId,
  entityLabel,
}: {
  open: boolean
  onClose: () => void
  entityId?: string
  entityLabel?: string
}) {
  const [entries, setEntries] = useState<ReceivableAuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntries([])
      return
    }
    setLoading(true)
    void getReceivableAuditTrail(entityId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [open, entityId])

  return (
    <ReceivableDrawerShell
      open={open}
      onClose={onClose}
      title="Audit trail"
      subtitle={entityLabel ?? entityId ?? 'All receivables events'}
      eyebrow="Receivables"
      widthClassName="max-w-md"
    >
      {loading ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">Loading audit trail…</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">No audit events recorded.</p>
      ) : (
        <ol className="relative space-y-0 border-l border-erp-border pl-4">
          {entries.map((entry, index) => (
            <li key={entry.id} className={cn('relative pb-5', index === entries.length - 1 && 'pb-0')}>
              <span className="absolute -left-[21px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-erp-border bg-white">
                <span className="h-1.5 w-1.5 rounded-full bg-erp-primary" />
              </span>
              <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-erp-text">{entry.action}</p>
                  {entry.isDemo ? (
                    <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 ring-1 ring-amber-200">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-erp-muted">{entry.entityType}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-erp-muted">
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatDateTime(entry.performedAt)} · {entry.performedBy}
                </p>
                {entry.details ? <p className="mt-2 text-[12px] text-erp-text">{entry.details}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-[11px] text-erp-muted">
        Demo audit log — events are stored in browser memory for UI demonstration only.
      </p>
    </ReceivableDrawerShell>
  )
}
