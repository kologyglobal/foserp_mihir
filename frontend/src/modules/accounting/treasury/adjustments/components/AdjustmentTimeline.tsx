import { Ban, CheckCircle2, Clock, Send, ThumbsDown, ThumbsUp, UploadCloud, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'
import { formatAdjustmentDateTime } from '../utils/format'

interface TimelineEntry {
  id: string
  label: string
  at: string
  icon: LucideIcon
  detail?: string | null
}

/**
 * Client-derived activity timeline. The adjustment DTO does not expose per-step timestamps
 * (unlike cheques/transfers), so this renders createdAt/updatedAt plus the current status.
 */
function buildTimeline(adjustment: TreasuryAdjustmentDto): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ id: 'created', label: 'Draft created', at: adjustment.createdAt, icon: Clock }]

  const statusIcon: Record<string, LucideIcon> = {
    PENDING_APPROVAL: Send,
    REJECTED: ThumbsDown,
    READY_TO_POST: CheckCircle2,
    POSTED: UploadCloud,
    CANCELLED: Ban,
    REVERSED: Undo2,
  }
  const statusLabel: Record<string, string> = {
    PENDING_APPROVAL: 'Submitted for approval',
    REJECTED: 'Rejected',
    READY_TO_POST: 'Marked ready to post',
    POSTED: 'Posted to GL',
    CANCELLED: 'Cancelled',
    REVERSED: 'Reversed',
  }

  if (adjustment.status !== 'DRAFT' && adjustment.updatedAt !== adjustment.createdAt) {
    entries.push({
      id: 'status',
      label: statusLabel[adjustment.status] ?? adjustment.status,
      at: adjustment.updatedAt,
      icon: statusIcon[adjustment.status] ?? ThumbsUp,
      detail: adjustment.rejectionReason ?? adjustment.cancellationReason ?? null,
    })
  }

  return entries.filter((e) => Boolean(e.at)).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export function AdjustmentTimeline({ adjustment }: { adjustment: TreasuryAdjustmentDto }) {
  const entries = buildTimeline(adjustment)

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
              <p className="text-erp-muted">{formatAdjustmentDateTime(entry.at)}</p>
              {entry.detail ? <p className="mt-0.5 text-erp-muted">{entry.detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
