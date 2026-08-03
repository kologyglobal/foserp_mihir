import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Calendar,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { Customer } from '@/types/master'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { CompanyCustomerBadge } from '@/components/masters/CompanyCustomerBadge'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import type { CrmCompanyStatus } from '@/utils/crmCompanyStatus'
import type { UnifiedFeedItem, UnifiedFeedKind } from '@/utils/crmUnifiedFeed'
import { cn } from '@/utils/cn'

const EMPTY = '—'

const KIND_ICON: Record<UnifiedFeedKind, LucideIcon> = {
  activity: Activity,
  note: MessageSquare,
  followup: Calendar,
  system: Sparkles,
}

export interface Customer360SummaryCardProps {
  customer: Customer
  status?: CrmCompanyStatus
  openOrders?: number
  pipelineValue?: number
  outstanding?: number | null
  moneyVisible?: boolean
  contactCount?: number
  nextFollowUpDate?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
  recentFeedItems?: UnifiedFeedItem[]
  onLogActivity?: () => void
  onViewAllActivities?: () => void
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function Customer360SummaryCard({
  customer,
  status,
  openOrders = 0,
  pipelineValue = 0,
  outstanding = null,
  moneyVisible = true,
  contactCount = 0,
  nextFollowUpDate,
  lastActivityAt,
  lastActivityLabel,
  recentFeedItems = [],
  onLogActivity,
  onViewAllActivities,
}: Customer360SummaryCardProps) {
  const location = [customer.city, customer.state].filter(Boolean).join(', ')
  const nextFollowUp = nextFollowUpDate ? formatDate(nextFollowUpDate) : null
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const activityCount = recentFeedItems.length
  const creditLimit =
    customer.creditLimit && customer.creditLimit > 0 ? customer.creditLimit : null

  return (
    <section
      className="lead-summary-card contact-summary-card"
      id="company-section-summary"
      aria-label="Company Summary"
    >
      <header className="lead-summary-card__head">
        <div className="contact-summary-card__identity">
          <div className="contact-summary-card__avatar" aria-hidden>
            {initials(customer.customerName)}
          </div>
          <div>
            <h2 className="lead-summary-card__title">Company Summary</h2>
            <p className="lead-summary-card__subtitle">
              Profile, commercial position, ownership, and recent activity.
            </p>
          </div>
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
              label="Company"
              value={customer.customerName}
              emptyLabel={EMPTY}
              className="lead-summary-card__field--primary"
            />
            <ErpViewField label="Code" value={customer.customerCode} emptyLabel={EMPTY} />
            <ErpViewField label="Party status" emptyLabel={EMPTY}>
              <CompanyCustomerBadge company={customer} />
            </ErpViewField>
            <ErpViewField label="Industry / type" value={customer.customerType} emptyLabel={EMPTY} />
            <ErpViewField label="Location" value={location} emptyLabel={EMPTY} />
            <ErpViewField label="Territory" value={customer.salesTerritory} emptyLabel={EMPTY} />
            <ErpViewField label="GSTIN" value={customer.gstin} emptyLabel={EMPTY} />

            <ErpViewField label="Primary contact" value={customer.contactPerson} emptyLabel={EMPTY} />
            <ErpViewPhone label="Phone" value={customer.contactPhone} emptyLabel={EMPTY} />
            <ErpViewEmail label="Email" value={customer.contactEmail} emptyLabel={EMPTY} />

            <ErpViewField
              label="Credit limit"
              value={creditLimit != null ? formatCurrency(creditLimit) : null}
              emptyLabel={EMPTY}
            />
            <ErpViewField
              label="Credit days"
              value={customer.creditDays != null && customer.creditDays > 0 ? String(customer.creditDays) : null}
              emptyLabel={EMPTY}
            />
            <ErpViewField label="Open sales orders" value={String(openOrders)} emptyLabel={EMPTY} />
            <ErpViewField
              label="Pipeline"
              value={formatCrmCurrency(pipelineValue)}
              emptyLabel={EMPTY}
            />
            <ErpViewField
              label="Outstanding"
              value={moneyVisible && outstanding != null ? formatCurrency(outstanding) : null}
              emptyLabel={moneyVisible ? EMPTY : '—'}
            />
            <ErpViewField label="CRM contacts" value={String(contactCount)} emptyLabel={EMPTY} />

            <ErpViewField label="Status" emptyLabel={EMPTY}>
              {status ? (
                <DynamicsStatusChip label={status.label} tone={status.tone} />
              ) : (
                <DynamicsStatusChip
                  label={customer.isActive === false ? 'Inactive' : 'Active'}
                  tone={customer.isActive === false ? 'neutral' : 'success'}
                />
              )}
            </ErpViewField>
            <ErpViewField label="Next follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
            <ErpViewField label="Last activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
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
              <p>No recent activities. Log a call, meeting, or follow-up for this company.</p>
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
                View CRM timeline
              </button>
            </footer>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
