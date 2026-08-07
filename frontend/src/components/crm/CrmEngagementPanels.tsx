import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  List,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  User,
  Users,
  Video,
} from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { ActivityTimeline } from './ActivityTimeline'
import { QuickFollowUpDrawer } from './QuickFollowUpDrawer'
import { LogActivityDrawer } from './CrmQuickCreateDrawers'
import { CrmEntityDetailDrawer } from './shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../types/crmEntity'
import { Select } from '../forms/Inputs'
import { enrichFollowUpStatus } from '../../utils/crmMetrics'
import { getSessionUser, canCrmPermission } from '../../utils/permissions'
import { resolveStoreAction } from '../../store/storeAction'
import { CrmDeleteConfirmModal } from './CrmDeleteConfirmModal'
import {
  RescheduleFollowUpModal,
  type RescheduleFollowUpTarget,
} from './RescheduleFollowUpModal'
import type { CrmActivity, FollowUp, FollowUpType } from '../../types/crm'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpButton } from '../erp/ErpButton'
import type { LucideIcon } from 'lucide-react'

export type CrmEngagementScope = 'lead' | 'pipeline' | 'quotation'

type FollowUpStatusView = 'today' | 'overdue' | 'upcoming' | 'completed'
type FollowUpOwnerScope = 'all' | 'mine'

const FOLLOW_UP_ICONS: Record<string, LucideIcon> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Video,
  site_visit: MapPin,
  demo: Calendar,
  quotation_follow_up: FileText,
  payment_follow_up: FileText,
  technical_discussion: FileText,
}

const FOLLOW_UP_ICON_TONE: Record<string, string> = {
  call: 'crm-engage-row__icon--call',
  email: 'crm-engage-row__icon--email',
  whatsapp: 'crm-engage-row__icon--whatsapp',
  meeting: 'crm-engage-row__icon--meeting',
  site_visit: 'crm-engage-row__icon--visit',
  demo: 'crm-engage-row__icon--demo',
  quotation_follow_up: 'crm-engage-row__icon--quote',
  payment_follow_up: 'crm-engage-row__icon--payment',
  technical_discussion: 'crm-engage-row__icon--tech',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function matchesEngagementScope(args: {
  opportunityId: string | null
  leadId: string | null | undefined
  quotationId?: string | null
  type?: string | null
  scope: CrmEngagementScope
}) {
  const { opportunityId, leadId, quotationId, type, scope } = args
  if (scope === 'lead') return Boolean(leadId) || !opportunityId
  if (scope === 'quotation') {
    if (quotationId) return true
    if (type === 'quotation_follow_up' || (type?.startsWith('quotation_') ?? false)) return true
    return false
  }
  return Boolean(opportunityId)
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDueLabel(dueDate: string, dueTime?: string | null) {
  const day = dueDate.slice(0, 10)
  const today = todayStr()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  const base =
    day === today
      ? 'Today'
      : day === tomorrowStr
        ? 'Tomorrow'
        : new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
          })
  return dueTime ? `${base} · ${dueTime}` : base
}

function priorityTone(priority: FollowUp['priority']): 'critical' | 'warning' | 'info' | 'neutral' {
  if (priority === 'critical') return 'critical'
  if (priority === 'high') return 'warning'
  if (priority === 'low') return 'neutral'
  return 'info'
}

function statusTone(status: FollowUp['status']): 'critical' | 'warning' | 'success' | 'neutral' | 'info' {
  if (status === 'overdue') return 'critical'
  if (status === 'completed') return 'success'
  if (status === 'pending') return 'info'
  if (status === 'snoozed') return 'warning'
  return 'neutral'
}

function FollowUpRow({
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
  const Icon = FOLLOW_UP_ICONS[followUp.followUpType as FollowUpType] ?? Bell
  const iconTone = FOLLOW_UP_ICON_TONE[followUp.followUpType] ?? ''
  const open = followUp.status === 'pending' || followUp.status === 'overdue'
  const overdue = followUp.status === 'overdue'
  const typeLabel = formatTypeLabel(followUp.followUpType)
  const showOpportunity =
    Boolean(opportunityName) && opportunityName!.toLowerCase() !== customerName.toLowerCase()

  return (
    <article className={`crm-engage-row${overdue ? ' crm-engage-row--overdue' : ''}`}>
      <div
        className={`crm-engage-row__icon${overdue ? ' crm-engage-row__icon--danger' : iconTone ? ` ${iconTone}` : ''}`}
        aria-hidden
        title={typeLabel}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>

      <div className="crm-engage-row__main">
        <div className="crm-engage-row__title-line">
          <span className="crm-engage-row__type-badge">
            <Icon className="h-3 w-3" aria-hidden />
            {typeLabel}
          </span>
          <button type="button" className="crm-engage-row__title" onClick={onOpenCustomer}>
            {customerName}
          </button>
        </div>
        <div className="crm-engage-row__meta-line">
          {contactName ? (
            <span className="crm-engage-row__contact">
              <User className="h-3 w-3" aria-hidden />
              {contactName}
            </span>
          ) : null}
          {showOpportunity ? (
            <button type="button" className="crm-engage-row__link" onClick={onOpenOpportunity}>
              {opportunityName}
            </button>
          ) : null}
          {followUp.assignedToName ? (
            <span className="crm-engage-row__assignee" title="Assigned to">
              <Users className="h-3 w-3" aria-hidden />
              {followUp.assignedToName}
            </span>
          ) : null}
        </div>
        {followUp.notes ? <p className="crm-engage-row__notes">{followUp.notes}</p> : null}
      </div>

      <div className="crm-engage-row__side">
        <div className="crm-engage-row__chips">
          <DynamicsStatusChip label={formatTypeLabel(followUp.status)} tone={statusTone(followUp.status)} />
          <DynamicsStatusChip label={formatTypeLabel(followUp.priority)} tone={priorityTone(followUp.priority)} />
        </div>
        <p className={`crm-engage-row__when${overdue ? ' crm-engage-row__when--danger' : ''}`}>
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {formatDueLabel(followUp.dueDate, followUp.dueTime)}
        </p>
      </div>

      <div className="crm-engage-row__actions">
        {open ? (
          <>
            <ErpButton type="button" size="sm" variant="primary" onClick={onDone}>
              Mark done
            </ErpButton>
            <ErpButton type="button" size="sm" variant="secondary" onClick={onReschedule}>
              Reschedule
            </ErpButton>
            <ErpButton type="button" size="sm" variant="ghost" onClick={onSnooze}>
              Snooze
            </ErpButton>
          </>
        ) : null}
        {onOpenNotes ? (
          <ErpButton type="button" size="sm" variant="ghost" icon={FileText} onClick={onOpenNotes}>
            Notes
          </ErpButton>
        ) : null}
      </div>
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
  const canCreateFollowUp = canCrmPermission('crm.follow_up.create')
  const [statusView, setStatusView] = useState<FollowUpStatusView>('today')
  const [ownerScope, setOwnerScope] = useState<FollowUpOwnerScope>('all')
  const [newFollowUpOpen, setNewFollowUpOpen] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleFollowUpTarget | null>(null)
  const [notesDetail, setNotesDetail] = useState<{
    entityType: CrmEntityTypeApi
    entityId: string
    title: string
    subtitle?: string
    demoNotes?: DemoEntityNote[]
  } | null>(null)
  const updateFollowUp = useCrmStore((s) => s.updateFollowUp)
  const user = getSessionUser()
  const today = todayStr()

  const scopedFollowUps = useMemo(
    () =>
      enrichFollowUpStatus(
        followUps.filter((f) =>
          matchesEngagementScope({
            opportunityId: f.opportunityId,
            leadId: f.leadId,
            quotationId: f.quotationId,
            type: f.followUpType,
            scope,
          }),
        ),
      ),
    [followUps, scope],
  )

  const filtered = useMemo(() => {
    return scopedFollowUps
      .filter((f) => {
        if (statusView === 'today') {
          if (!(f.status === 'pending' && f.dueDate.slice(0, 10) === today)) return false
        } else if (statusView === 'overdue') {
          if (f.status !== 'overdue') return false
        } else if (statusView === 'upcoming') {
          if (!(f.status === 'pending' && f.dueDate.slice(0, 10) > today)) return false
        } else if (statusView === 'completed') {
          if (f.status !== 'completed') return false
        }

        if (ownerScope === 'mine') return f.assignedTo === user?.id
        return true
      })
      .sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1
        if (b.status === 'overdue' && a.status !== 'overdue') return 1
        return `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`)
      })
  }, [scopedFollowUps, statusView, ownerScope, today, user?.id])

  const counts = useMemo(
    () => ({
      today: scopedFollowUps.filter((f) => f.status === 'pending' && f.dueDate.slice(0, 10) === today).length,
      overdue: scopedFollowUps.filter((f) => f.status === 'overdue').length,
      upcoming: scopedFollowUps.filter((f) => f.status === 'pending' && f.dueDate.slice(0, 10) > today).length,
      completed: scopedFollowUps.filter((f) => f.status === 'completed').length,
    }),
    [scopedFollowUps, today],
  )

  const statusViews: { id: FollowUpStatusView; label: string; count: number; icon: LucideIcon; tone: string }[] = [
    { id: 'today', label: 'Due today', count: counts.today, icon: CalendarClock, tone: '' },
    { id: 'overdue', label: 'Overdue', count: counts.overdue, icon: AlertTriangle, tone: 'crm-engage-stat--danger' },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, icon: Calendar, tone: '' },
    { id: 'completed', label: 'Completed', count: counts.completed, icon: CheckCircle2, tone: 'crm-engage-stat--success' },
  ]

  const ownerViews: { id: FollowUpOwnerScope; label: string; icon: LucideIcon }[] = [
    { id: 'all', label: 'Everyone', icon: Users },
    { id: 'mine', label: 'Mine', icon: User },
  ]

  const scopeHint =
    scope === 'lead'
      ? 'Prospecting touchpoints before a deal enters the pipeline'
      : scope === 'quotation'
        ? 'Commercial follow-ups on quotations and quote revision cycles'
        : 'Scheduled touchpoints linked to opportunities'

  const emptyIcon =
    statusView === 'overdue' ? AlertTriangle : statusView === 'completed' || statusView === 'today' ? CheckCircle2 : Bell
  const EmptyIcon = emptyIcon

  return (
    <div className="crm-engage">
      <header className="crm-engage__header">
        <div className="crm-engage__header-brand">
          <div className="crm-engage__icon-plate" aria-hidden>
            <Bell className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="crm-engage__header-text">
            <h2 className="crm-engage__title">Follow-ups</h2>
            <p className="crm-engage__subtitle">{scopeHint}</p>
          </div>
        </div>
        {canCreateFollowUp ? (
          <ErpButton type="button" size="sm" variant="primary" icon={Plus} onClick={() => setNewFollowUpOpen(true)}>
            New follow-up
          </ErpButton>
        ) : null}
      </header>

      <div className="crm-engage__stats" role="group" aria-label="Follow-up summary">
        {statusViews.map((stat) => {
          const StatIcon = stat.icon
          return (
            <button
              key={stat.id}
              type="button"
              className={`crm-engage-stat${stat.tone ? ` ${stat.tone}` : ''}${statusView === stat.id ? ' crm-engage-stat--active' : ''}`}
              onClick={() => setStatusView(stat.id)}
              aria-pressed={statusView === stat.id}
            >
              <span className="crm-engage-stat__top">
                <span className="crm-engage-stat__label">{stat.label}</span>
                <StatIcon className="crm-engage-stat__icon" aria-hidden />
              </span>
              <span className="crm-engage-stat__value">{stat.count}</span>
            </button>
          )
        })}
      </div>

      <div className="crm-engage__toolbar">
        <div className="crm-engage-tabs" role="tablist" aria-label="Owner filter">
          {ownerViews.map((v) => {
            const TabIcon = v.icon
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={ownerScope === v.id}
                className={`crm-engage-tab${ownerScope === v.id ? ' crm-engage-tab--active' : ''}`}
                onClick={() => setOwnerScope(v.id)}
              >
                <TabIcon className="crm-engage-tab__icon" aria-hidden />
                {v.label}
              </button>
            )
          })}
        </div>
        <p className="crm-engage__result-count">
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="crm-engage-empty">
          <div className="crm-engage-empty__icon" aria-hidden>
            <EmptyIcon className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="crm-engage-empty__title">
            {statusView === 'overdue'
              ? 'No overdue follow-ups'
              : statusView === 'today'
                ? 'Nothing due today'
                : statusView === 'upcoming'
                  ? 'No upcoming follow-ups'
                  : 'No completed follow-ups'}
          </p>
          <p className="crm-engage-empty__desc">
            {ownerScope === 'mine'
              ? 'None of your assigned follow-ups match this status — try Everyone or another status card.'
              : statusView === 'today'
                ? 'You are clear for today — a good time to prospect or advance open deals.'
                : 'Try another status card or schedule a new follow-up.'}
          </p>
          {canCreateFollowUp ? (
            <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setNewFollowUpOpen(true)}>
              Schedule follow-up
            </ErpButton>
          ) : null}
        </div>
      ) : (
        <div className="crm-engage-list" role="list">
          {filtered.map((f) => {
            const cust = customers.find((c) => c.id === f.customerId)
            const contact = f.contactId ? contacts.find((c) => c.id === f.contactId) : null
            const opp = f.opportunityId ? opportunities.find((o) => o.id === f.opportunityId) : null
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            return (
              <FollowUpRow
                key={f.id}
                followUp={f}
                customerName={cust?.customerName ?? COMPANY_TERMINOLOGY.singular}
                contactName={contact?.name}
                opportunityName={opp?.opportunityName}
                onDone={() => completeFollowUp(f.id, 'Completed via follow-up panel')}
                onReschedule={() =>
                  setRescheduleTarget({
                    id: f.id,
                    dueDate: f.dueDate,
                    dueTime: f.dueTime,
                    label: cust?.customerName ?? COMPANY_TERMINOLOGY.singular,
                  })
                }
                onSnooze={() => snoozeFollowUp(f.id, tomorrow.toISOString().slice(0, 10))}
                onOpenCustomer={() => f.customerId && navigate(entity360CustomerPath(f.customerId))}
                onOpenOpportunity={() => f.opportunityId && navigate(`/crm/opportunities/${f.opportunityId}`)}
                onOpenNotes={() =>
                  setNotesDetail({
                    entityType: 'FOLLOW_UP',
                    entityId: f.id,
                    title: formatTypeLabel(f.followUpType),
                    subtitle: `${f.dueDate} · ${f.assignedToName}`,
                    demoNotes: demoNotesFromTexts([{ label: 'Follow-up notes', text: f.notes }]),
                  })
                }
              />
            )
          })}
        </div>
      )}

      <QuickFollowUpDrawer open={newFollowUpOpen} onClose={() => setNewFollowUpOpen(false)} />
      <RescheduleFollowUpModal
        open={Boolean(rescheduleTarget)}
        followUp={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onReschedule={async (values) => {
          if (!rescheduleTarget) return
          await resolveStoreAction(rescheduleFollowUp(rescheduleTarget.id, values.dueDate, values.dueTime))
          if (values.reason) {
            const existing = followUps.find((x) => x.id === rescheduleTarget.id)
            const noteLine = `Reschedule: ${values.reason}`
            const nextNotes = existing?.notes?.trim() ? `${existing.notes.trim()}\n${noteLine}` : noteLine
            await resolveStoreAction(updateFollowUp(rescheduleTarget.id, { notes: nextNotes }))
          }
        }}
      />
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
  const opportunities = useCrmStore((s) => s.opportunities)
  const canCreate = canCrmPermission('crm.activity.create')
  const canDelete = canCrmPermission('crm.activity.delete')
  const canComplete = canCrmPermission('crm.activity.complete')
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
    () =>
      activities.filter((a) =>
        matchesEngagementScope({
          opportunityId: a.opportunityId,
          leadId: a.leadId,
          quotationId: a.quotationId,
          type: a.type,
          scope,
        }),
      ),
    [activities, scope],
  )

  const types = useMemo(() => [...new Set(scopedActivities.map((a) => a.type))].sort(), [scopedActivities])
  const owners = useMemo(() => [...new Set(scopedActivities.map((a) => a.ownerName))].sort(), [scopedActivities])
  const activeCustomers = useMemo(() => {
    const ids = new Set(scopedActivities.map((a) => a.customerId).filter(Boolean))
    return customers.filter((c) => ids.has(c.id)).sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [customers, scopedActivities])

  const filtered = useMemo(() => {
    return scopedActivities
      .filter((a) => {
        if (typeFilter && a.type !== typeFilter) return false
        if (customerFilter && a.customerId !== customerFilter) return false
        if (ownerFilter && a.ownerName !== ownerFilter) return false
        return true
      })
      .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
  }, [scopedActivities, typeFilter, customerFilter, ownerFilter])

  const weekCount = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return scopedActivities.filter((a) => new Date(a.activityDate) >= weekAgo).length
  }, [scopedActivities])

  const dealsTouched = useMemo(
    () => new Set(scopedActivities.map((a) => a.opportunityId).filter(Boolean)).size,
    [scopedActivities],
  )

  const scopeHint =
    scope === 'lead'
      ? 'Calls, meetings, and notes before a deal is in the pipeline'
      : scope === 'quotation'
        ? 'Logged interactions on quotations — sends, revisions, and approvals'
        : 'Logged interactions on open and closed opportunities'

  const hasFilters = Boolean(typeFilter || customerFilter || ownerFilter)

  return (
    <div className="crm-engage">
      <header className="crm-engage__header">
        <div className="crm-engage__header-brand">
          <div className="crm-engage__icon-plate crm-engage__icon-plate--activity" aria-hidden>
            <Activity className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="crm-engage__header-text">
            <h2 className="crm-engage__title">Activities</h2>
            <p className="crm-engage__subtitle">{scopeHint}</p>
          </div>
        </div>
        <div className="crm-engage__header-actions">
          <div className="crm-engage-view-toggle" role="group" aria-label="Activity layout">
            <button
              type="button"
              className={`crm-engage-view-toggle__btn${viewMode === 'timeline' ? ' crm-engage-view-toggle__btn--active' : ''}`}
              aria-pressed={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
            >
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Timeline
            </button>
            <button
              type="button"
              className={`crm-engage-view-toggle__btn${viewMode === 'list' ? ' crm-engage-view-toggle__btn--active' : ''}`}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              List
            </button>
          </div>
          {canCreate ? (
            <ErpButton type="button" size="sm" variant="primary" icon={Plus} onClick={() => setLogActivityOpen(true)}>
              Log activity
            </ErpButton>
          ) : null}
        </div>
      </header>

      <div className="crm-engage__stats" role="group" aria-label="Activity summary">
        <div className="crm-engage-stat">
          <span className="crm-engage-stat__label">Total</span>
          <span className="crm-engage-stat__value">{scopedActivities.length}</span>
        </div>
        <div className="crm-engage-stat">
          <span className="crm-engage-stat__label">This week</span>
          <span className="crm-engage-stat__value">{weekCount}</span>
        </div>
        <div className="crm-engage-stat">
          <span className="crm-engage-stat__label">Deals touched</span>
          <span className="crm-engage-stat__value">{dealsTouched}</span>
        </div>
        <div className="crm-engage-stat">
          <span className="crm-engage-stat__label">Showing</span>
          <span className="crm-engage-stat__value">{filtered.length}</span>
        </div>
      </div>

      <div className="crm-engage__filters">
        <Select className="crm-engage-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {formatTypeLabel(t)}
            </option>
          ))}
        </Select>
        <Select className="crm-engage-select crm-engage-select--wide" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
          <option value="">All {COMPANY_TERMINOLOGY.plural.toLowerCase()}</option>
          {activeCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customerName}
            </option>
          ))}
        </Select>
        <Select className="crm-engage-select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        {hasFilters ? (
          <ErpButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setTypeFilter('')
              setCustomerFilter('')
              setOwnerFilter('')
            }}
          >
            Clear filters
          </ErpButton>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="crm-engage-empty">
          <Activity className="h-8 w-8 text-erp-muted" aria-hidden />
          <p className="crm-engage-empty__title">{hasFilters ? 'No matching activities' : 'No activities yet'}</p>
          <p className="crm-engage-empty__desc">
            {hasFilters
              ? 'Adjust filters to see more interactions.'
              : 'Log a call, meeting, or note to build the deal history.'}
          </p>
          {canCreate && !hasFilters ? (
            <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setLogActivityOpen(true)}>
              Log activity
            </ErpButton>
          ) : null}
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="crm-engage-timeline-shell">
          <ActivityTimeline
            activities={filtered}
            canComplete={canComplete}
            canDelete={canDelete}
            pendingActivityId={pendingActivityId}
            onOpenNotes={(activity) =>
              setNotesDetail({
                entityType: 'ACTIVITY',
                entityId: activity.id,
                title: activity.subject,
                subtitle: formatTypeLabel(activity.type),
                demoNotes: demoNotesFromTexts([{ label: 'Description', text: activity.description }]),
              })
            }
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
            customerName={(id) => customers.find((c) => c.id === id)?.customerName}
            opportunityName={(id) => opportunities.find((o) => o.id === id)?.opportunityName}
          />
        </div>
      ) : (
        <div className="crm-engage-table-wrap">
          <table className="crm-engage-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Subject</th>
                <th>{COMPANY_TERMINOLOGY.singular}</th>
                <th>Deal</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const completed = Boolean(a.outcome?.trim())
                const deal = a.opportunityId ? opportunities.find((o) => o.id === a.opportunityId) : null
                return (
                  <tr key={a.id}>
                    <td className="crm-engage-table__date">
                      {new Date(a.activityDate).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className="crm-engage-type-pill">{formatTypeLabel(a.type)}</span>
                    </td>
                    <td className="crm-engage-table__subject">{a.subject}</td>
                    <td>{customers.find((c) => c.id === a.customerId)?.customerName ?? '-'}</td>
                    <td className="crm-engage-table__muted">{deal?.opportunityName ?? '-'}</td>
                    <td>{a.ownerName}</td>
                    <td>
                      {completed ? (
                        <DynamicsStatusChip label="Completed" tone="success" />
                      ) : (
                        <DynamicsStatusChip label="Open" tone="info" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <LogActivityDrawer open={logActivityOpen} onClose={() => setLogActivityOpen(false)} />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={
          deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from the timeline.` : undefined
        }
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
