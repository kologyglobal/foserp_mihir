import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { PayableDrawerShell } from './PayableDrawerShell'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

export interface PayableAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string | null
  performedBy: string
  performedAt: string
  isDemo?: boolean
}

const DEMO_AUDIT: PayableAuditEntry[] = [
  {
    id: 'audit-pay-1',
    entityType: 'Vendor Payment',
    entityId: 'demo',
    action: 'Payment submitted',
    details: 'Submitted for approval in demo mode.',
    performedBy: 'Priya Sharma',
    performedAt: new Date(Date.now() - 86_400_000).toISOString(),
    isDemo: true,
  },
  {
    id: 'audit-pay-2',
    entityType: 'Payment Proposal',
    entityId: 'demo',
    action: 'Proposal approved',
    details: 'Approved by Rahul Mehta (demo).',
    performedBy: 'Rahul Mehta',
    performedAt: new Date(Date.now() - 172_800_000).toISOString(),
    isDemo: true,
  },
  {
    id: 'audit-pay-3',
    entityType: 'Payable Invoice',
    entityId: 'demo',
    action: 'Three-way match reviewed',
    details: 'Match variance within tolerance.',
    performedBy: 'Rohit Jain',
    performedAt: new Date(Date.now() - 259_200_000).toISOString(),
    isDemo: true,
  },
]

export function PayableAuditDrawer({
  open,
  onClose,
  entityId,
  entityLabel,
  entries: presetEntries,
}: {
  open: boolean
  onClose: () => void
  entityId?: string
  entityLabel?: string
  entries?: PayableAuditEntry[]
}) {
  const [entries, setEntries] = useState<PayableAuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntries([])
      return
    }
    if (presetEntries) {
      setEntries(presetEntries)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      const filtered = entityId
        ? DEMO_AUDIT.filter((e) => e.entityId === entityId || e.entityId === 'demo')
        : DEMO_AUDIT
      setEntries(filtered)
      setLoading(false)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [open, entityId, presetEntries])

  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title="Audit trail"
      subtitle={entityLabel ?? entityId ?? 'All payables events'}
      eyebrow="Payables"
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
    </PayableDrawerShell>
  )
}
