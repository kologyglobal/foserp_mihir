import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  MapPin,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react'
import type { CrmActivity } from '../../types/crm'
import { ErpButton } from '../erp/ErpButton'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { CrmDrawerShell } from './CrmDrawerShell'

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
  customerName?: (customerId: string | null | undefined) => string | undefined
  opportunityName?: (opportunityId: string | null | undefined) => string | undefined
}

function isActivityCompleted(activity: CrmActivity): boolean {
  return Boolean(activity.outcome?.trim())
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

function dayHeading(iso: string) {
  const day = dayKey(iso)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)
  if (day === today) return 'Today'
  if (day === yStr) return 'Yesterday'
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
  customerName,
  opportunityName,
}: ActivityTimelineProps) {
  const [completeTarget, setCompleteTarget] = useState<CrmActivity | null>(null)
  const [outcomeDraft, setOutcomeDraft] = useState('')

  const items = useMemo(() => {
    const sorted = [...activities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    return limit ? sorted.slice(0, limit) : sorted
  }, [activities, limit])

  const groups = useMemo(() => {
    const map = new Map<string, CrmActivity[]>()
    for (const act of items) {
      const key = dayKey(act.activityDate)
      const list = map.get(key) ?? []
      list.push(act)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [items])

  if (!items.length) {
    return <p className="crm-engage-empty__desc py-6 text-center">{emptyMessage}</p>
  }

  function submitComplete() {
    if (!completeTarget || !onComplete) return
    onComplete({ ...completeTarget, outcome: outcomeDraft.trim() || 'Completed' })
    setCompleteTarget(null)
    setOutcomeDraft('')
  }

  return (
    <div className="crm-activity-timeline">
      {groups.map(([key, acts]) => (
        <section key={key} className="crm-activity-group">
          <h3 className="crm-activity-group-title">{dayHeading(key)}</h3>
          <ul className="crm-activity-group-list">
            {acts.map((act, idx) => {
              const Icon = TYPE_ICONS[act.type] ?? FileText
              const completed = isActivityCompleted(act)
              const isPending = pendingActivityId === act.id
              const company = customerName?.(act.customerId)
              const deal = opportunityName?.(act.opportunityId)
              return (
                <li key={act.id} className="crm-activity-item">
                  {idx < acts.length - 1 ? <span className="crm-activity-line" aria-hidden /> : null}
                  <div className="crm-activity-icon">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="crm-activity-body">
                    <div className="crm-activity-header">
                      <span className="crm-activity-subject">{act.subject}</span>
                      <span className="crm-activity-time">
                        {new Date(act.activityDate).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {completed ? (
                        <DynamicsStatusChip label="Completed" tone="success" />
                      ) : (
                        <DynamicsStatusChip label={formatTypeLabel(act.type)} tone="info" />
                      )}
                    </div>
                    {(company || deal) && (
                      <p className="crm-activity-context">
                        {company}
                        {company && deal ? ' · ' : null}
                        {deal}
                      </p>
                    )}
                    {act.description ? <p className="crm-activity-desc">{act.description}</p> : null}
                    {act.outcome ? (
                      <p className="crm-activity-outcome">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {act.outcome}
                      </p>
                    ) : null}
                    <p className="crm-activity-owner">{act.ownerName}</p>
                    {onOpenNotes || (!completed && (canComplete || canDelete)) ? (
                      <div className="crm-activity-actions">
                        {onOpenNotes ? (
                          <ErpButton type="button" size="sm" variant="ghost" icon={FileText} onClick={() => onOpenNotes(act)}>
                            Notes
                          </ErpButton>
                        ) : null}
                        {!completed && canComplete && onComplete ? (
                          <ErpButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            icon={CheckCircle2}
                            disabled={isPending}
                            onClick={() => {
                              setCompleteTarget(act)
                              setOutcomeDraft('')
                            }}
                          >
                            {isPending ? 'Saving…' : 'Complete'}
                          </ErpButton>
                        ) : null}
                        {!completed && canDelete && onDelete ? (
                          <ErpButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            disabled={isPending}
                            onClick={() => onDelete(act)}
                          >
                            Delete
                          </ErpButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <CrmDrawerShell
        open={Boolean(completeTarget)}
        placement="modal"
        size="sm"
        icon={CheckCircle2}
        accent="success"
        title="Complete activity"
        subtitle={completeTarget?.subject}
        onClose={() => setCompleteTarget(null)}
        closeDisabled={Boolean(completeTarget && pendingActivityId === completeTarget.id)}
        footer={
          <div className="crm-popup-footer__actions">
            <ErpButton type="button" variant="secondary" onClick={() => setCompleteTarget(null)}>
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              onClick={submitComplete}
              disabled={!completeTarget || pendingActivityId === completeTarget.id}
            >
              {completeTarget && pendingActivityId === completeTarget.id ? 'Saving…' : 'Mark complete'}
            </ErpButton>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            Outcome
          </span>
          <input
            className="erp-input w-full"
            value={outcomeDraft}
            onChange={(e) => setOutcomeDraft(e.target.value)}
            placeholder="Call completed, meeting held, etc."
          />
        </label>
      </CrmDrawerShell>
    </div>
  )
}
