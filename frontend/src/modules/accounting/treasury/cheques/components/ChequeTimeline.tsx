import { Ban, CheckCircle2, Clock, PiggyBank, Send, ThumbsDown, ThumbsUp, Undo2, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TreasuryChequeDto } from '../api/treasury-cheque.types'
import { formatChequeDateTime } from '../utils/format'

interface TimelineEntry {
  id: string
  label: string
  at: string
  icon: LucideIcon
  detail?: string | null
}

function buildTimeline(cheque: TreasuryChequeDto): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ id: 'created', label: 'Draft created', at: cheque.createdAt, icon: Clock }]
  if (cheque.submittedAt) entries.push({ id: 'submitted', label: 'Submitted for approval', at: cheque.submittedAt, icon: Send })
  if (cheque.approvedAt) entries.push({ id: 'approved', label: 'Approved', at: cheque.approvedAt, icon: ThumbsUp })
  if (cheque.rejectedAt) {
    entries.push({ id: 'rejected', label: 'Rejected', at: cheque.rejectedAt, icon: ThumbsDown, detail: cheque.rejectionReason })
  }
  if (cheque.readyAt) entries.push({ id: 'ready', label: 'Marked ready', at: cheque.readyAt, icon: CheckCircle2 })
  if (cheque.issuedAt) entries.push({ id: 'issued', label: 'Issued', at: cheque.issuedAt, icon: Send })
  if (cheque.depositedAt) entries.push({ id: 'deposited', label: 'Deposited', at: cheque.depositedAt, icon: PiggyBank })
  if (cheque.clearedAt) entries.push({ id: 'cleared', label: 'Cleared', at: cheque.clearedAt, icon: CheckCircle2 })
  if (cheque.bouncedAt) entries.push({ id: 'bounced', label: 'Bounced', at: cheque.bouncedAt, icon: XCircle, detail: cheque.bounceReason })
  if (cheque.stoppedAt) entries.push({ id: 'stopped', label: 'Stop payment recorded', at: cheque.stoppedAt, icon: Ban, detail: cheque.stopReason })
  if (cheque.cancelledAt) {
    entries.push({ id: 'cancelled', label: 'Cancelled', at: cheque.cancelledAt, icon: Ban, detail: cheque.cancellationReason })
  }
  if (cheque.reversedAt) {
    entries.push({ id: 'reversed', label: 'Reversed', at: cheque.reversedAt, icon: Undo2, detail: cheque.reversalReason })
  }
  return entries
    .filter((e) => Boolean(e.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

/** Client-derived activity timeline from the cheque's audit timestamps (no dedicated history endpoint). */
export function ChequeTimeline({ cheque }: { cheque: TreasuryChequeDto }) {
  const entries = buildTimeline(cheque)

  if (entries.length === 0) {
    return <p className="text-[12px] text-erp-muted">No activity yet.</p>
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const Icon = entry.icon
        return (
          <li key={entry.id} className="flex items-start gap-2 text-[12px]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-erp-surface-alt text-erp-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="font-medium text-erp-text">{entry.label}</p>
              <p className="text-erp-muted">{formatChequeDateTime(entry.at)}</p>
              {entry.detail ? <p className="mt-0.5 text-erp-muted">{entry.detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
