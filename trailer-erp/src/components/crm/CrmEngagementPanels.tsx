import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, List, Plus } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { ActivityTimeline } from './ActivityTimeline'
import { QuickFollowUpDrawer } from './QuickFollowUpDrawer'
import { LogActivityDrawer } from './CrmQuickCreateDrawers'
import { CrmEntityDetailDrawer } from './shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../types/crmEntity'
import { CommandBar, CommandBarButton, CommandBarGroup } from './CrmPageShell'
import { Select } from '../forms/Inputs'
import { enrichFollowUpStatus } from '../../utils/crmMetrics'
import { getSessionUser } from '../../utils/permissions'
import { canPermission } from '../../utils/permissions'
import { resolveStoreAction } from '../../store/storeAction'
import { CrmDeleteConfirmModal } from './CrmDeleteConfirmModal'
import type { CrmActivity, FollowUp } from '../../types/crm'

export type CrmEngagementScope = 'lead' | 'pipeline'

type FollowUpView = 'today' | 'overdue' | 'upcoming' | 'completed' | 'mine' | 'team'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function matchesEngagementScope(
  opportunityId: string | null,
  leadId: string | null | undefined,
  scope: CrmEngagementScope,
) {
  if (scope === 'lead') return Boolean(leadId) || !opportunityId
  return Boolean(opportunityId)
}

function FollowUpCard({
  followUp,
  customerName,
  contactName,
  opportunityName,
  onDone,
  onReschedule,
  onSnooze,
  onOpenCustomer,
  onOpenOpportunity,
  onOpenNotes,
}: {
  followUp: FollowUp
  customerName: string
  contactName?: string
  opportunityName?: string
  onDone: () => void
  onReschedule: () => void
  onSnooze: () => void
  onOpenCustomer: () => void
  onOpenOpportunity: () => void
  onOpenNotes?: () => void
}) {
  const priorityTone = followUp.priority === 'critical' ? 'critical' : followUp.priority === 'high' ? 'warning' : 'healthy'
  return (
    <article className={`rounded-lg border p-4 ${followUp.status === 'overdue' ? 'border-red-300 bg-red-50/40' : 'border-erp-border bg-erp-surface'}`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-semibold text-erp-text">{customerName}</p>
          {contactName ? <p className="text-xs text-erp-muted">{contactName}</p> : null}
          {opportunityName ? <p className="text-xs text-erp-primary mt-0.5">{opportunityName}</p> : null}
        </div>
        <LiveStatusBadge label={followUp.priority} tone={priorityTone} pulse={false} />
      </div>
      <p className="text-sm capitalize mt-2 text-erp-text">{followUp.followUpType.replace(/_/g, ' ')}</p>
      <p className="text-xs text-erp-muted mt-1">{followUp.dueDate} · {followUp.dueTime} · {followUp.assignedToName}</p>
      <p className="text-sm mt-2 text-erp-text">{followUp.notes}</p>
      {(followUp.status === 'pending' || followUp.status === 'overdue') && (
        <div className="flex flex-wrap gap-1 mt-3">
          {onOpenNotes ? (
            <button type="button" className="text-[10px] border border-erp-border rounded px-2 py-1 text-erp-text" onClick={onOpenNotes}>Notes</button>
          ) : null}
          <button type="button" className="text-[10px] border border-erp-border rounded px-2 py-1 bg-erp-primary text-white" onClick={onDone}>Mark Done</button>
          <button type="button" className="text-[10px] border border-erp-border rounded px-2 py-1 text-erp-text" onClick={onReschedule}>Reschedule</button>
          <button type="button" className="text-[10px] border border-erp-border rounded px-2 py-1 text-erp-text" onClick={onSnooze}>Snooze</button>
          <button type="button" className="text-[10px] border border-erp-border rounded px-2 py-1 text-erp-text" onClick={onOpenCustomer}>Company</button>
          {followUp.opportunityId ? (
            <button type="button" className="text-[10px] border rounded px-2 py-1" onClick={onOpenOpportunity}>Opportunity</button>
          ) : null}
        </div>
      )}
    </article>
  )
}

export function CrmFollowUpsPanel({ scope }: { scope: CrmEngagementScope }) {
  const navigate = useNavigate()
  const followUps = useCrmStore((s) => s.followUps)
  const opportunities = useCrmStore((s) => s.opportunities)
  const contacts = useCrmStore((s) => s.contacts)
  const customers = useMasterStore((s) => s.customers)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const rescheduleFollowUp = useCrmStore((s) => s.rescheduleFollowUp)
  const snoozeFollowUp = useCrmStore((s) => s.snoozeFollowUp)
  const [view, setView] = useState<FollowUpView>('today')
  const [newFollowUpOpen, setNewFollowUpOpen] = useState(false)
  const [notesDetail, setNotesDetail] = useState<{
    entityType: CrmEntityTypeApi
    entityId: string
    title: string
    subtitle?: string
    demoNotes?: DemoEntityNote[]
  } | null>(null)
  const user = getSessionUser()
  const today = todayStr()

  const scopedFollowUps = useMemo(
    () => enrichFollowUpStatus(followUps.filter((f) => matchesEngagementScope(f.opportunityId, f.leadId, scope))),
    [followUps, scope],
  )

  const filtered = useMemo(() => {
    return scopedFollowUps.filter((f) => {
      if (view === 'today') return f.status === 'pending' && f.dueDate.slice(0, 10) === today
      if (view === 'overdue') return f.status === 'overdue'
      if (view === 'upcoming') return f.status === 'pending' && f.dueDate.slice(0, 10) > today
      if (view === 'completed') return f.status === 'completed'
      if (view === 'mine') return f.assignedTo === user?.id && f.status !== 'completed'
      if (view === 'team') return f.status !== 'completed' && f.status !== 'cancelled'
      return true
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [scopedFollowUps, view, today, user?.id])

  const counts = useMemo(() => ({
    today: scopedFollowUps.filter((f) => f.status === 'pending' && f.dueDate.slice(0, 10) === today).length,
    overdue: scopedFollowUps.filter((f) => f.status === 'overdue').length,
    upcoming: scopedFollowUps.filter((f) => f.status === 'pending' && f.dueDate.slice(0, 10) > today).length,
    completed: scopedFollowUps.filter((f) => f.status === 'completed').length,
  }), [scopedFollowUps, today])

  const views: { id: FollowUpView; label: string; count?: number }[] = [
    { id: 'today', label: 'Today', count: counts.today },
    { id: 'overdue', label: 'Overdue', count: counts.overdue },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'mine', label: 'My Follow-ups' },
    { id: 'team', label: 'Team Follow-ups' },
  ]

  const scopeHint = scope === 'lead'
    ? 'Prospecting and pre-pipeline touchpoints'
    : 'Deal follow-ups linked to opportunities'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-erp-muted">{scopeHint}</p>
        <CommandBar>
          <CommandBarGroup>
            <CommandBarButton icon={Plus} label="New Follow-up" primary onClick={() => setNewFollowUpOpen(true)} />
          </CommandBarGroup>
        </CommandBar>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Due Today</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{counts.today}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Overdue</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-erp-danger">{counts.overdue}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Upcoming</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{counts.upcoming}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Completed</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{counts.completed}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-erp-border pb-2">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`text-sm px-3 py-1.5 rounded-t border-b-2 ${view === v.id ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
            onClick={() => setView(v.id)}
          >
            {v.label}{v.count !== undefined ? ` (${v.count})` : ''}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((f) => {
          const cust = customers.find((c) => c.id === f.customerId)
          const contact = f.contactId ? contacts.find((c) => c.id === f.contactId) : null
          const opp = f.opportunityId ? opportunities.find((o) => o.id === f.opportunityId) : null
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          return (
            <FollowUpCard
              key={f.id}
              followUp={f}
              customerName={cust?.customerName ?? COMPANY_TERMINOLOGY.singular}
              contactName={contact?.name}
              opportunityName={opp?.opportunityName}
              onDone={() => completeFollowUp(f.id, 'Completed via follow-up panel')}
              onReschedule={() => {
                const d = prompt('New due date (YYYY-MM-DD)', f.dueDate)
                if (d) rescheduleFollowUp(f.id, d, f.dueTime ?? '10:00')
              }}
              onSnooze={() => snoozeFollowUp(f.id, tomorrow.toISOString().slice(0, 10))}
              onOpenCustomer={() => f.customerId && navigate(`/entity360/customers/${f.customerId}/360`)}
              onOpenOpportunity={() => f.opportunityId && navigate(`/crm/opportunities/${f.opportunityId}`)}
              onOpenNotes={() => setNotesDetail({
                entityType: 'FOLLOW_UP',
                entityId: f.id,
                title: f.followUpType.replace(/_/g, ' '),
                subtitle: `${f.dueDate} · ${f.assignedToName}`,
                demoNotes: demoNotesFromTexts([{ label: 'Follow-up notes', text: f.notes }]),
              })}
            />
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="text-[13px] text-erp-muted text-center py-8">No follow-ups in this view.</p>
      ) : null}
      <QuickFollowUpDrawer open={newFollowUpOpen} onClose={() => setNewFollowUpOpen(false)} />
      <CrmEntityDetailDrawer
        open={!!notesDetail}
        onClose={() => setNotesDetail(null)}
        entityType={notesDetail?.entityType ?? 'FOLLOW_UP'}
        entityId={notesDetail?.entityId ?? null}
        title={notesDetail?.title ?? 'Notes'}
        subtitle={notesDetail?.subtitle}
        demoNotes={notesDetail?.demoNotes}
      />
    </div>
  )
}

export function CrmActivitiesPanel({ scope }: { scope: CrmEngagementScope }) {
  const activities = useCrmStore((s) => s.activities)
  const completeActivity = useCrmStore((s) => s.completeActivity)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const customers = useMasterStore((s) => s.customers)
  const canDelete = canPermission('sales', 'override')
  const canComplete = canPermission('sales', 'edit')
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')
  const [typeFilter, setTypeFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [notesDetail, setNotesDetail] = useState<{
    entityType: CrmEntityTypeApi
    entityId: string
    title: string
    subtitle?: string
    demoNotes?: DemoEntityNote[]
  } | null>(null)

  const scopedActivities = useMemo(
    () => activities.filter((a) => matchesEngagementScope(a.opportunityId, a.leadId, scope)),
    [activities, scope],
  )

  const types = useMemo(() => [...new Set(scopedActivities.map((a) => a.type))].sort(), [scopedActivities])
  const owners = useMemo(() => [...new Set(scopedActivities.map((a) => a.ownerName))].sort(), [scopedActivities])

  const filtered = useMemo(() => {
    return scopedActivities.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false
      if (customerFilter && a.customerId !== customerFilter) return false
      if (ownerFilter && a.ownerName !== ownerFilter) return false
      return true
    }).sort((a, b) => b.activityDate.localeCompare(a.activityDate))
  }, [scopedActivities, typeFilter, customerFilter, ownerFilter])

  const scopeHint = scope === 'lead'
    ? 'Calls, meetings, and notes before a deal is in the pipeline'
    : 'Logged interactions on open and won opportunities'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-erp-muted">{scopeHint}</p>
        <CommandBar>
          <CommandBarGroup>
            <CommandBarButton icon={Plus} label="Log Activity" primary onClick={() => setLogActivityOpen(true)} />
            <CommandBarButton icon={Activity} label="Timeline" primary={viewMode === 'timeline'} onClick={() => setViewMode('timeline')} />
            <CommandBarButton icon={List} label="List" primary={viewMode === 'list'} onClick={() => setViewMode('list')} />
          </CommandBarGroup>
        </CommandBar>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Total</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{scopedActivities.length}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">This Week</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {scopedActivities.filter((a) => {
              const d = new Date(a.activityDate)
              const weekAgo = new Date()
              weekAgo.setDate(weekAgo.getDate() - 7)
              return d >= weekAgo
            }).length}
          </p>
        </div>
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase text-erp-muted">Opportunities Touched</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {new Set(scopedActivities.map((a) => a.opportunityId).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select className="h-8 text-[13px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </Select>
        <Select className="h-8 min-w-[10rem] text-[13px]" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
          <option value="">All companies</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </Select>
        <Select className="h-8 min-w-[9rem] text-[13px]" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </div>

      {viewMode === 'timeline' ? (
        <ActivityTimeline
          activities={filtered}
          canComplete={canComplete}
          canDelete={canDelete}
          pendingActivityId={pendingActivityId}
          onOpenNotes={(activity) => setNotesDetail({
            entityType: 'ACTIVITY',
            entityId: activity.id,
            title: activity.subject,
            subtitle: activity.type.replace(/_/g, ' '),
            demoNotes: demoNotesFromTexts([{ label: 'Description', text: activity.description }]),
          })}
          onComplete={(activity) => {
            setPendingActivityId(activity.id)
            void (async () => {
              try {
                await resolveStoreAction(completeActivity(activity.id, activity.outcome ?? 'Completed'))
              } finally {
                setPendingActivityId(null)
              }
            })()
          }}
          onDelete={(activity) => setDeleteActivityTarget(activity)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-erp-border">
          <table className="w-full text-[13px]">
            <thead className="border-b border-erp-border bg-erp-surface-alt">
              <tr>
                <th className="p-2 text-left font-semibold text-erp-muted">Date</th>
                <th className="p-2 text-left font-semibold text-erp-muted">Type</th>
                <th className="p-2 text-left font-semibold text-erp-muted">Subject</th>
                <th className="p-2 text-left font-semibold text-erp-muted">{COMPANY_TERMINOLOGY.singular}</th>
                <th className="p-2 text-left font-semibold text-erp-muted">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-erp-border">
                  <td className="p-2 text-erp-text">{new Date(a.activityDate).toLocaleString('en-IN')}</td>
                  <td className="p-2 capitalize text-erp-text">{a.type.replace(/_/g, ' ')}</td>
                  <td className="p-2 text-erp-text">{a.subject}</td>
                  <td className="p-2 text-erp-text">{customers.find((c) => c.id === a.customerId)?.customerName}</td>
                  <td className="p-2 text-erp-text">{a.ownerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LogActivityDrawer open={logActivityOpen} onClose={() => setLogActivityOpen(false)} />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from the timeline.` : undefined}
        confirmLabel="Delete activity"
        onCancel={() => setDeleteActivityTarget(null)}
        onConfirm={() => {
          if (!deleteActivityTarget) return
          setPendingActivityId(deleteActivityTarget.id)
          void (async () => {
            try {
              await resolveStoreAction(deleteActivity(deleteActivityTarget.id))
              setDeleteActivityTarget(null)
            } finally {
              setPendingActivityId(null)
            }
          })()
        }}
        isDeleting={pendingActivityId === deleteActivityTarget?.id}
      />
      <CrmEntityDetailDrawer
        open={!!notesDetail}
        onClose={() => setNotesDetail(null)}
        entityType={notesDetail?.entityType ?? 'ACTIVITY'}
        entityId={notesDetail?.entityId ?? null}
        title={notesDetail?.title ?? 'Notes'}
        subtitle={notesDetail?.subtitle}
        demoNotes={notesDetail?.demoNotes}
      />
    </div>
  )
}
