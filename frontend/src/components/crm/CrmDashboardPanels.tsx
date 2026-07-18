import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Phone,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { CrmActivity, FollowUp, Opportunity } from '../../types/crm'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import type { CrmNextAction } from '../../utils/crmNextActions'
import type { StuckOpportunityInsight } from '../../utils/crmStuckAnalysis'
import { formatCrmCurrency, getWonDealNextErpStep, type CrmQuotationApprovalRow } from '../../utils/crmMetrics'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpButton } from '../erp/ErpButton'
import { GroupedActivityTimeline } from './GroupedActivityTimeline'
import { CrmHotDealsChart } from './CrmDashboardCharts'
import {
  RescheduleFollowUpModal,
  type RescheduleFollowUpTarget,
} from './RescheduleFollowUpModal'
import { cn } from '../../utils/cn'

const FOLLOW_UP_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  meeting: Calendar,
  site_visit: Target,
  demo: Sparkles,
  email: Activity,
  quotation_follow_up: TrendingUp,
}

const ACTION_BORDER: Record<string, string> = {
  critical: 'crm-action-card-critical',
  high: 'crm-action-card-high',
  medium: 'crm-action-card-normal',
  low: 'crm-action-card-normal',
}

const PRIORITY_TONE: Record<string, 'critical' | 'warning' | 'info' | 'neutral'> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
}

interface CustomerLookup {
  customerName: (id: string) => string
  productName: (id: string) => string
}

export function CrmFollowUpsPanel({
  followUps,
  customers,
  contacts,
  opportunities,
  onSchedule,
  onComplete,
  onReschedule,
}: {
  followUps: FollowUp[]
  customers: { id: string; customerName: string }[]
  contacts: { id: string; name: string }[]
  opportunities: Opportunity[]
  onSchedule: () => void
  onComplete: (id: string) => void
  onReschedule: (id: string, dueDate: string, dueTime: string, reason?: string) => void
}) {
  const navigate = useNavigate()
  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleFollowUpTarget | null>(null)

  return (
    <>
    <DynamicsDashboardPanel
      title="Today's follow-ups"
      actions={
        followUps.length > 0 ? (
          <DynamicsStatusChip label={`${followUps.length} due`} tone="warning" />
        ) : null
      }
      noPadding
    >
      {followUps.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No follow-ups due today</p>
          <p className="crm-helper-text">You're clear for today — great time to prospect.</p>
          <ErpButton type="button" size="sm" variant="secondary" onClick={onSchedule}>
            Schedule follow-up
          </ErpButton>
        </div>
      ) : (
        <ul className="crm-followup-list">
          {followUps.slice(0, 8).map((f) => {
            const cust = customers.find((c) => c.id === f.customerId)
            const contact = f.contactId ? contacts.find((c) => c.id === f.contactId) : null
            const opp = f.opportunityId ? opportunities.find((o) => o.id === f.opportunityId) : null
            const Icon = FOLLOW_UP_ICONS[f.followUpType] ?? Calendar
            return (
              <li key={f.id} className="crm-followup-card">
                <div className="crm-followup-icon">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="crm-followup-body">
                  <div className="crm-followup-header">
                    <div className="min-w-0">
                      <p className="crm-card-title">{cust?.customerName ?? 'Customer'}</p>
                      {contact ? <p className="crm-helper-text">{contact.name}</p> : null}
                      {opp ? <p className="crm-followup-opp">{opp.opportunityName}</p> : null}
                    </div>
                    <div className="crm-followup-meta">
                      <DynamicsStatusChip
                        label={f.status === 'overdue' ? 'Overdue' : f.priority}
                        tone={f.status === 'overdue' || f.priority === 'critical' ? 'critical' : PRIORITY_TONE[f.priority] ?? 'warning'}
                      />
                      <span className="crm-followup-time">{f.dueTime}</span>
                    </div>
                  </div>
                  <p className="crm-helper-text capitalize">{f.followUpType.replace(/_/g, ' ')} · {f.assignedToName}</p>
                  <div className="crm-followup-actions">
                    <ErpButton type="button" size="sm" onClick={() => onComplete(f.id)}>
                      Mark done
                    </ErpButton>
                    <ErpButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setRescheduleTarget({
                          id: f.id,
                          dueDate: f.dueDate,
                          dueTime: f.dueTime,
                          label: cust?.customerName ?? 'Follow-up',
                        })
                      }
                    >
                      Reschedule
                    </ErpButton>
                    {opp ? (
                      <ErpButton type="button" size="sm" variant="secondary" onClick={() => navigate(`/crm/opportunities/${opp.id}`)}>
                        Open deal
                      </ErpButton>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </DynamicsDashboardPanel>
    <RescheduleFollowUpModal
      open={Boolean(rescheduleTarget)}
      followUp={rescheduleTarget}
      onClose={() => setRescheduleTarget(null)}
      onReschedule={(values) => {
        if (!rescheduleTarget) return
        onReschedule(rescheduleTarget.id, values.dueDate, values.dueTime, values.reason || undefined)
      }}
    />
    </>
  )
}

export function CrmNextActionsPanel({ actions }: { actions: CrmNextAction[] }) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Next best actions" noPadding>
      {actions.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No urgent actions</p>
          <p className="crm-helper-text">Pipeline is on track — review hot opportunities.</p>
        </div>
      ) : (
        <ul className="crm-next-actions-grid">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={cn('crm-action-card', ACTION_BORDER[a.priority] ?? ACTION_BORDER.medium)}
                onClick={() => navigate(a.route)}
              >
                <div className="crm-action-card-header">
                  <DynamicsStatusChip label={a.priority} tone={PRIORITY_TONE[a.priority] ?? 'info'} />
                  {a.valueImpact ? (
                    <span className="crm-action-value">{a.valueImpact}</span>
                  ) : null}
                </div>
                <p className="crm-card-title">{a.title}</p>
                <p className="crm-helper-text line-clamp-2">{a.reason}</p>
                {(a.customerName || a.opportunityName) && (
                  <p className="crm-helper-text">
                    {[a.customerName, a.opportunityName].filter(Boolean).join(' · ')}
                  </p>
                )}
                {a.ownerName ? <p className="crm-helper-text">Owner: {a.ownerName}</p> : null}
                <span className="crm-action-cta">{a.actionLabel} →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmHotOpportunitiesPanel({
  opportunities,
  lookup,
  maxValue,
}: {
  opportunities: Opportunity[]
  lookup: CustomerLookup
  maxValue: number
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel
      title="Hot opportunities"
      actions={
        <ErpButton type="button" size="sm" variant="link" onClick={() => navigate('/crm/opportunities')}>
          View all
        </ErpButton>
      }
      noPadding
    >
      {opportunities.length === 0 ? (
        <div className="crm-empty-state">
          <Flame className="h-8 w-8 text-erp-muted/50" />
          <p className="crm-card-title">No high-value deals flagged</p>
          <p className="crm-helper-text">Deals above ₹20L or high priority appear here.</p>
        </div>
      ) : (
        <>
          <CrmHotDealsChart opportunities={opportunities} maxValue={maxValue} />
          <ul className="crm-hot-list">
          {opportunities.map((o) => {
            const barPct = (o.value / maxValue) * 100
            const healthTone =
              o.healthScore >= 70 ? 'healthy' : o.healthScore >= 45 ? 'warning' : 'critical'
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className="crm-hot-row"
                  onClick={() => navigate(`/crm/opportunities/${o.id}`)}
                >
                  <div className="crm-hot-row-main">
                    <div className="crm-hot-row-top">
                      <p className="crm-card-title">{o.opportunityName}</p>
                      <span className="crm-hot-value">{formatCrmCurrency(o.value)}</span>
                    </div>
                    <p className="crm-helper-text">
                      {lookup.customerName(o.customerId)} · {o.productId ? lookup.productName(o.productId) : 'Product TBD'} · {o.ownerName}
                    </p>
                    <div className="crm-hot-row-meta">
                      <DynamicsStatusChip label={opportunityStageLabel(o.stage)} tone="info" />
                      <span className="crm-helper-text">{o.probability}% · close {o.expectedCloseDate?.slice(0, 10)}</span>
                      <DynamicsStatusChip
                        label={healthTone === 'healthy' ? 'Healthy' : healthTone === 'warning' ? 'Watch' : 'At risk'}
                        tone={healthTone === 'healthy' ? 'success' : healthTone === 'warning' ? 'warning' : 'critical'}
                      />
                    </div>
                    <div className="crm-hot-progress">
                      <div className="crm-hot-progress-bar" style={{ width: `${barPct}%` }} />
                    </div>
                    <p className="crm-helper-text">Next: {o.nextFollowUpDate ? `Follow-up ${o.nextFollowUpDate}` : 'Schedule activity'}</p>
                  </div>
                </button>
              </li>
            )
          })}
          </ul>
        </>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmStuckOpportunitiesPanel({ insights }: { insights: StuckOpportunityInsight[] }) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Stuck opportunities" noPadding>
      {insights.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No stuck opportunities</p>
          <p className="crm-helper-text">Pipeline is moving — keep momentum.</p>
          <ErpButton type="button" size="sm" variant="secondary" onClick={() => navigate('/crm/opportunities')}>
            View pipeline
          </ErpButton>
        </div>
      ) : (
        <ul className="crm-stuck-list">
          {insights.slice(0, 6).map(({ opportunity: o, daysStuck, riskReason, riskTone }) => (
            <li key={o.id}>
              <button type="button" className="crm-stuck-row" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                <div className="crm-stuck-row-top">
                  <div className="min-w-0">
                    <p className="crm-card-title">{o.opportunityName}</p>
                    <p className="crm-helper-text">{o.ownerName}</p>
                  </div>
                  <span className="crm-hot-value">{formatCrmCurrency(o.value)}</span>
                </div>
                <div className="crm-stuck-row-meta">
                  <DynamicsStatusChip label={opportunityStageLabel(o.stage)} tone="neutral" />
                  <DynamicsStatusChip label={`${daysStuck}d stuck`} tone={riskTone === 'critical' ? 'critical' : 'warning'} />
                </div>
                <p className="crm-stuck-reason">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {riskReason}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmQuotationApprovalPanel({
  documents,
  customers,
  opportunities,
  loading = false,
  error = null,
  onRetry,
}: {
  documents: CrmQuotationApprovalRow[]
  customers: { id: string; customerName: string }[]
  opportunities: Opportunity[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Quotation approval queue" noPadding>
      {loading ? (
        <div className="crm-empty-state">
          <p className="crm-helper-text">Loading approval queue…</p>
        </div>
      ) : error ? (
        <div className="crm-empty-state">
          <AlertTriangle className="h-8 w-8 text-erp-warning" />
          <p className="crm-card-title">Could not load approval queue</p>
          <p className="crm-helper-text">{error}</p>
          {onRetry ? (
            <ErpButton type="button" size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </ErpButton>
          ) : null}
        </div>
      ) : documents.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No quotations awaiting approval</p>
          <ErpButton type="button" size="sm" variant="secondary" onClick={() => navigate('/crm/quotations')}>
            View quotations
          </ErpButton>
        </div>
      ) : (
        <ul className="crm-approval-list">
          {documents.map((d) => {
            const opp = d.opportunityId ? opportunities.find((o) => o.id === d.opportunityId) : null
            const cust = opp ? customers.find((c) => c.id === opp.customerId) : null
            const pendingStart = (d.submittedAt ?? d.createdAt).slice(0, 10)
            const ageDays = Math.floor((Date.now() - new Date(pendingStart).getTime()) / 86400000)
            const highValue = d.totalAmount >= 3000000
            const titleCode = d.quotationCode?.trim() || d.quotationId
            return (
              <li key={d.id}>
                <button
                  type="button"
                  className="crm-approval-row w-full text-left transition-colors hover:bg-erp-surface-alt/60"
                  onClick={() => navigate(`/crm/quotations/${d.quotationId}`)}
                >
                  <div className="crm-approval-row-top">
                    <div>
                      <p className="crm-card-title">
                        {titleCode} · Rev {d.revisionNo}
                      </p>
                      <p className="crm-helper-text">{d.customerName ?? cust?.customerName ?? 'Customer'}</p>
                    </div>
                    <span className="crm-hot-value">{formatCrmCurrency(d.totalAmount)}</span>
                  </div>
                  <div className="crm-stuck-row-meta">
                    <DynamicsStatusChip label={`${ageDays}d pending`} tone={ageDays >= 5 ? 'warning' : 'neutral'} />
                    {highValue ? <DynamicsStatusChip label="High value" tone="critical" /> : null}
                    <span className="crm-helper-text">{d.salesOwnerName}</span>
                  </div>
                  <div className="crm-followup-actions">
                    <ErpButton
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/crm/quotations/${d.quotationId}/editor?doc=${d.id}`)
                      }}
                    >
                      Review
                    </ErpButton>
                    <ErpButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/crm/quotations/${d.quotationId}`)
                      }}
                    >
                      Open quotation
                    </ErpButton>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmRecentActivitiesPanel({
  activities,
  lookup,
}: {
  activities: CrmActivity[]
  lookup: CustomerLookup
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel
      title="Recent activities"
      actions={
        <ErpButton type="button" size="sm" variant="link" onClick={() => navigate('/crm/opportunities?view=activities')}>
          View all
        </ErpButton>
      }
      noPadding
    >
      <div className="p-4">
        <GroupedActivityTimeline activities={activities} limit={10} lookup={lookup} />
      </div>
    </DynamicsDashboardPanel>
  )
}

export function CrmRecentlyWonPanel({
  deals,
  lookup,
}: {
  deals: Opportunity[]
  lookup: CustomerLookup
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Recently won" noPadding>
      {deals.length === 0 ? (
        <div className="crm-empty-state">
          <Clock className="h-8 w-8 text-erp-muted/50" />
          <p className="crm-card-title">No won deals yet</p>
        </div>
      ) : (
        <ul className="crm-won-list">
          {deals.map((o) => (
            <li key={o.id}>
              <button type="button" className="crm-won-row" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                <div className="crm-won-row-top">
                  <div className="min-w-0 text-left">
                    <p className="crm-card-title">{o.opportunityName}</p>
                    <p className="crm-helper-text">{lookup.customerName(o.customerId)} · {o.ownerName}</p>
                  </div>
                  <span className="crm-won-value">{formatCrmCurrency(o.value)}</span>
                </div>
                <div className="crm-stuck-row-meta">
                  <span className="crm-helper-text">Won {(o.modifiedAt ?? o.createdAt).slice(0, 10)}</span>
                  <DynamicsStatusChip label={getWonDealNextErpStep(o)} tone="success" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmDealOutcomesPanel({
  openCount,
  wonCount,
  lostCount,
  conversionRate,
  weightedForecast,
}: {
  openCount: number
  wonCount: number
  lostCount: number
  conversionRate: number
  weightedForecast: number
}) {
  return (
    <DynamicsDashboardPanel title="Deal outcomes" noPadding>
      <div className="crm-outcomes-panel">
        <div className="crm-outcomes-ring">
          <span className="crm-kpi-value">{conversionRate}%</span>
          <span className="crm-kpi-label">Win rate</span>
        </div>
        <div className="crm-outcomes-stats">
          <div className="crm-outcome-stat crm-outcome-open">
            <span className="crm-kpi-label">Open</span>
            <span className="crm-body-text font-semibold">{openCount}</span>
          </div>
          <div className="crm-outcome-stat crm-outcome-won">
            <span className="crm-kpi-label">Won</span>
            <span className="crm-body-text font-semibold">{wonCount}</span>
          </div>
          <div className="crm-outcome-stat crm-outcome-lost">
            <span className="crm-kpi-label">Lost</span>
            <span className="crm-body-text font-semibold">{lostCount}</span>
          </div>
          <div className="crm-outcome-forecast">
            <span className="crm-helper-text">Weighted forecast</span>
            <span className="crm-card-title text-erp-primary">{formatCrmCurrency(weightedForecast)}</span>
          </div>
        </div>
      </div>
    </DynamicsDashboardPanel>
  )
}
