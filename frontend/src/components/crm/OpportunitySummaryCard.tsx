import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Calendar,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { Opportunity } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { opportunityPriorityLabel, opportunityStageLabel } from '@/utils/opportunityUtils'
import { opportunityRequirementDisplay } from '@/utils/leadRequirementLines'
import type { UnifiedFeedItem, UnifiedFeedKind } from '@/utils/crmUnifiedFeed'
import { cn } from '@/utils/cn'

const EMPTY = '—'

const KIND_ICON: Record<UnifiedFeedKind, LucideIcon> = {
  activity: Activity,
  note: MessageSquare,
  followup: Calendar,
  system: Sparkles,
}

export interface OpportunitySummaryCardProps {
  opportunity: Opportunity
  customerName?: string | null
  customerId?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  city?: string | null
  productName?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
  dealValueLabel?: string
  dealValueHint?: string
  dealValue?: number
  recentFeedItems?: UnifiedFeedItem[]
  onLogActivity?: () => void
  onViewAllActivities?: () => void
}

function stageTone(stage: string): 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'pending' {
  if (stage === 'won') return 'success'
  if (stage === 'lost') return 'critical'
  if (stage === 'on_hold') return 'warning'
  return 'info'
}

function formatFeedWhen(at: string): string {
  try {
    if (!at?.trim()) return formatDate(null)
    if (at.length >= 16) return formatDateTime(at)
    return formatDate(at)
  } catch {
    return formatDate(null)
  }
}

export function OpportunitySummaryCard({
  opportunity,
  customerName,
  customerId,
  contactName,
  contactPhone,
  contactEmail,
  city,
  productName,
  lastActivityAt,
  lastActivityLabel,
  dealValueLabel = 'Deal Value',
  dealValueHint,
  dealValue,
  recentFeedItems = [],
  onLogActivity,
  onViewAllActivities,
}: OpportunitySummaryCardProps) {
  const nextFollowUp = opportunity.nextFollowUpDate
    ? formatDate(opportunity.nextFollowUpDate)
    : null
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const resolvedCustomerId = customerId ?? opportunity.customerId
  const activityCount = recentFeedItems.length

  return (
    <section className="lead-summary-card" id="opp-section-summary" aria-label="Opportunity Summary">
      <header className="lead-summary-card__head">
        <div>
          <h2 className="lead-summary-card__title">Opportunity Summary</h2>
          <p className="lead-summary-card__subtitle">
            Customer, contact, ownership, status, and recent activity.
          </p>
        </div>
        {onLogActivity ? (
          <ErpButton
            type="button"
            size="sm"
            variant="primary"
            icon={Activity}
            className="lead-summary-card__log-btn"
            onClick={onLogActivity}
          >
            Log activity
          </ErpButton>
        ) : null}
      </header>

      <div className="lead-summary-card__split">
        <div className="lead-summary-card__main">
          <div className="lead-summary-card__fields">
            <ErpViewField
              label="Opportunity Name"
              value={opportunity.opportunityName}
              emptyLabel={EMPTY}
              className="lead-summary-card__field--primary"
            />
            <ErpViewField label="Customer" emptyLabel={EMPTY}>
              {resolvedCustomerId && customerName ? (
                <AppLink to={entity360CustomerPath(resolvedCustomerId)} className="erp-view-field__link">
                  {customerName}
                </AppLink>
              ) : undefined}
            </ErpViewField>
            <ErpViewField label="City" value={city} emptyLabel={EMPTY} />
            <ErpViewField
              label="Product Requirement"
              value={opportunityRequirementDisplay(opportunity.productRequirement)}
              emptyLabel={EMPTY}
            />
            {productName ? (
              <ErpViewField label="Linked Product" value={productName} emptyLabel={EMPTY} />
            ) : null}

            <ErpViewField label="Contact Person" value={contactName} emptyLabel={EMPTY} />
            <ErpViewPhone label="Mobile" value={contactPhone} emptyLabel={EMPTY} />
            <ErpViewEmail label="Email" value={contactEmail} emptyLabel={EMPTY} />

            <ErpViewField label="Owner" value={opportunity.ownerName} emptyLabel={EMPTY} />
            <ErpViewField label="Priority" value={opportunityPriorityLabel(opportunity.priority)} emptyLabel={EMPTY} />
            <ErpViewField label="Created Date" value={formatDate(opportunity.createdAt)} emptyLabel={EMPTY} />
            <ErpViewField
              label={dealValueLabel}
              value={formatCrmCurrency(dealValue ?? opportunity.value)}
              hint={dealValueHint}
              emptyLabel={EMPTY}
            />

            <ErpViewField label="Stage" emptyLabel={EMPTY}>
              <DynamicsStatusChip
                label={opportunityStageLabel(opportunity.stage)}
                tone={stageTone(opportunity.stage)}
              />
            </ErpViewField>
            <ErpViewField label="Status" value={opportunity.status} emptyLabel={EMPTY} />
            <ErpViewField label="Next Follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
            <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
          </div>
        </div>

        <aside className="lead-summary-card__activities" aria-label="Activities">
          <header className="lead-summary-card__activities-head">
            <div className="lead-summary-card__activities-title-row">
              <span className="lead-summary-card__act-icon" aria-hidden>
                <Activity className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="lead-summary-card__act-title">Activities</h3>
                <p className="lead-summary-card__activities-sub">
                  {activityCount > 0
                    ? `${activityCount} recent ${activityCount === 1 ? 'item' : 'items'}`
                    : 'No activity yet'}
                </p>
              </div>
            </div>
          </header>

          {activityCount === 0 ? (
            <div className="lead-summary-card__activities-empty">
              <p>No recent activities. Log a call, meeting, or follow-up to start the timeline.</p>
            </div>
          ) : (
            <ol className="lead-summary-card__timeline">
              {recentFeedItems.map((item, idx) => {
                const Icon = KIND_ICON[item.kind]
                return (
                  <li key={item.id} className="lead-summary-card__timeline-item">
                    {idx < recentFeedItems.length - 1 ? (
                      <span className="lead-summary-card__timeline-rail" aria-hidden />
                    ) : null}
                    <span
                      className={cn(
                        'lead-summary-card__timeline-node',
                        `lead-summary-card__timeline-node--${item.kind}`,
                      )}
                      aria-hidden
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="lead-summary-card__timeline-body">
                      <div className="lead-summary-card__timeline-top">
                        <span className="lead-summary-card__timeline-title">{item.title}</span>
                        <time className="lead-summary-card__timeline-when" dateTime={item.at || undefined}>
                          {formatFeedWhen(item.at)}
                        </time>
                      </div>
                      {item.body ? (
                        <p className="lead-summary-card__timeline-text">{item.body}</p>
                      ) : null}
                      <div className="lead-summary-card__timeline-meta">
                        {item.meta ? <span>{item.meta}</span> : null}
                        {item.badge ? (
                          <span className="lead-summary-card__timeline-badge">
                            {item.badge.replace(/_/g, ' ')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {onViewAllActivities && activityCount > 0 ? (
            <footer className="lead-summary-card__activities-foot">
              <button type="button" className="lead-summary-card__view-all" onClick={onViewAllActivities}>
                View full timeline
              </button>
            </footer>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
