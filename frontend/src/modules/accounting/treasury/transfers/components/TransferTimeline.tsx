import { Ban, CheckCircle2, Clock, Send, ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'
import { formatTransferDateTime } from '../utils/format'

interface TimelineEntry {
  id: string
  label: string
  at: string
  icon: LucideIcon
  detail?: string | null
}

function buildTimeline(transfer: TreasuryTransferDto): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    { id: 'created', label: 'Draft created', at: transfer.createdAt, icon: Clock },
  ]
  if (transfer.submittedAt) entries.push({ id: 'submitted', label: 'Submitted for approval', at: transfer.submittedAt, icon: Send })
  if (transfer.approvedAt) entries.push({ id: 'approved', label: 'Approved', at: transfer.approvedAt, icon: ThumbsUp })
  if (transfer.rejectedAt) {
    entries.push({ id: 'rejected', label: 'Rejected', at: transfer.rejectedAt, icon: ThumbsDown, detail: transfer.rejectionReason })
  }
  if (transfer.readyToPostAt) entries.push({ id: 'ready', label: 'Marked ready to post', at: transfer.readyToPostAt, icon: CheckCircle2 })
  if (transfer.dispatchedAt) entries.push({ id: 'dispatched', label: 'Dispatched', at: transfer.dispatchedAt, icon: Send })
  if (transfer.receivedAt) entries.push({ id: 'received', label: 'Received', at: transfer.receivedAt, icon: CheckCircle2 })
  if (transfer.completedAt) entries.push({ id: 'completed', label: 'Completed', at: transfer.completedAt, icon: CheckCircle2 })
  if (transfer.cancelledAt) {
    entries.push({ id: 'cancelled', label: 'Cancelled', at: transfer.cancelledAt, icon: Ban, detail: transfer.cancellationReason })
  }
  if (transfer.reversedAt) {
    entries.push({ id: 'reversed', label: 'Reversed', at: transfer.reversedAt, icon: Undo2, detail: transfer.reversalReason })
  }
  return entries
    .filter((e) => Boolean(e.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

/** Client-derived activity timeline from the transfer's audit timestamps (no dedicated history endpoint). */
export function TransferTimeline({ transfer }: { transfer: TreasuryTransferDto }) {
  const entries = buildTimeline(transfer)

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
              <p className="text-erp-muted">{formatTransferDateTime(entry.at)}</p>
              {entry.detail ? <p className="mt-0.5 text-erp-muted">{entry.detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
