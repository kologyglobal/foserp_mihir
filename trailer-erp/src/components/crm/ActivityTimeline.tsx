import { useMemo, useState } from 'react'
import { CheckCircle2, Phone, Mail, MessageCircle, Calendar, MapPin, FileText, Clock, Trash2 } from 'lucide-react'
import type { CrmActivity } from '../../types/crm'
import { ErpButton } from '../erp/ErpButton'

const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Calendar,
  site_visit: MapPin,
  note: FileText,
  stage_change: Clock,
  quotation_created: FileText,
  quotation_sent: FileText,
  quotation_revised: FileText,
  quotation_approved: FileText,
  quotation_rejected: FileText,
  follow_up_completed: Clock,
  deal_won: FileText,
  deal_lost: FileText,
  sales_order_created: FileText,
}

interface ActivityTimelineProps {
  activities: CrmActivity[]
  limit?: number
  emptyMessage?: string
  canComplete?: boolean
  canDelete?: boolean
  onComplete?: (activity: CrmActivity) => void
  onDelete?: (activity: CrmActivity) => void
  onOpenNotes?: (activity: CrmActivity) => void
  pendingActivityId?: string | null
}

function isActivityCompleted(activity: CrmActivity): boolean {
  return Boolean(activity.outcome?.trim())
}

export function ActivityTimeline({
  activities,
  limit,
  emptyMessage = 'No activities yet.',
  canComplete = false,
  canDelete = false,
  onComplete,
  onDelete,
  onOpenNotes,
  pendingActivityId,
}: ActivityTimelineProps) {
  const [completeTarget, setCompleteTarget] = useState<CrmActivity | null>(null)
  const [outcomeDraft, setOutcomeDraft] = useState('')

  const items = useMemo(() => {
    const sorted = [...activities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    return limit ? sorted.slice(0, limit) : sorted
  }, [activities, limit])

  if (!items.length) {
    return <p className="py-2 text-[13px] text-erp-muted">{emptyMessage}</p>
  }

  function submitComplete() {
    if (!completeTarget || !onComplete) return
    onComplete({ ...completeTarget, outcome: outcomeDraft.trim() || 'Completed' })
    setCompleteTarget(null)
    setOutcomeDraft('')
  }

  return (
    <div className="space-y-0">
      {items.map((act, idx) => {
        const Icon = TYPE_ICONS[act.type] ?? FileText
        const completed = isActivityCompleted(act)
        const isPending = pendingActivityId === act.id
        return (
          <div key={act.id} className="relative flex gap-3 pb-4">
            {idx < items.length - 1 ? (
              <span className="absolute left-[11px] top-7 bottom-0 w-px bg-erp-border" aria-hidden />
            ) : null}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-erp-primary/10 text-erp-primary">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13px] font-medium text-erp-text">{act.subject}</span>
                <span className="text-[11px] text-erp-muted">
                  {new Date(act.activityDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {act.description ? (
                <p className="mt-0.5 text-[13px] text-erp-muted">{act.description}</p>
              ) : null}
              {act.outcome ? (
                <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                  {act.outcome}
                </span>
              ) : null}
              <p className="mt-1 text-[11px] text-erp-muted">{act.ownerName}</p>
              {onOpenNotes || (!completed && (canComplete || canDelete)) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {onOpenNotes ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-0.5 text-[11px] text-erp-text hover:bg-erp-surface-muted"
                      onClick={() => onOpenNotes(act)}
                    >
                      <FileText className="h-3 w-3" />
                      Notes
                    </button>
                  ) : null}
                  {!completed && canComplete && onComplete ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-0.5 text-[11px] text-erp-text hover:bg-erp-surface-muted disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => {
                        setCompleteTarget(act)
                        setOutcomeDraft('')
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {isPending ? 'Saving…' : 'Complete'}
                    </button>
                  ) : null}
                  {!completed && canDelete && onDelete ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => onDelete(act)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
      {completeTarget ? (
        <div className="erp-modal-backdrop" role="dialog" aria-modal="true">
          <div className="erp-modal-panel max-w-sm">
            <h3 className="text-[14px] font-semibold text-erp-text">Complete activity</h3>
            <p className="mt-1 text-[12px] text-erp-muted">{completeTarget.subject}</p>
            <label className="mt-3 block text-[12px] font-medium text-erp-text">
              Outcome
              <input
                className="erp-input mt-1 w-full"
                value={outcomeDraft}
                onChange={(e) => setOutcomeDraft(e.target.value)}
                placeholder="Call completed, meeting held, etc."
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <ErpButton type="button" variant="secondary" onClick={() => setCompleteTarget(null)}>
                Cancel
              </ErpButton>
              <ErpButton type="button" variant="primary" onClick={submitComplete} disabled={pendingActivityId === completeTarget.id}>
                {pendingActivityId === completeTarget.id ? 'Saving…' : 'Mark complete'}
              </ErpButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
