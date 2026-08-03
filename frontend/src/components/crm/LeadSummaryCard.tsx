import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Calendar,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { Lead } from '@/types/sales'
import type { CrmContact } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { LeadStageChip } from '@/components/crm/LeadStageChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { formatStatus } from '@/components/ui/Badge'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { leadPriorityLabel } from '@/utils/leadUtils'
import { leadQualificationLabel } from '@/utils/lead360Utils'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { normalizeEmail } from '@/utils/validation/email'
import type { UnifiedFeedItem, UnifiedFeedKind } from '@/utils/crmUnifiedFeed'
import { cn } from '@/utils/cn'

const EMPTY = '—'

const KIND_ICON: Record<UnifiedFeedKind, LucideIcon> = {
  activity: Activity,
  note: MessageSquare,
  followup: Calendar,
  system: Sparkles,
}

export interface LeadSummaryCardProps {
  lead: Lead
  customerName?: string | null
  designation?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
  /** Chronological feed (newest first) for the right-hand Activities column. */
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

export function resolveLeadContactDesignation(
  lead: Lead,
  contacts: CrmContact[],
): string | null {
  if (!contacts.length) return null
  const phone = lead.mobile?.replace(/\D/g, '')
  const email = lead.email ? normalizeEmail(lead.email) : ''
  const name = lead.contactPerson?.trim().toLowerCase()
  const pool = lead.customerId
    ? contacts.filter((c) => c.customerId === lead.customerId)
    : contacts
  const match =
    pool.find((c) => email && c.email && normalizeEmail(c.email) === email)
    ?? pool.find((c) => phone && c.phone?.replace(/\D/g, '') === phone)
    ?? pool.find((c) => name && c.name.trim().toLowerCase() === name)
  return match?.designation?.trim() || null
}

export function LeadSummaryCard({
  lead,
  customerName,
  designation,
  lastActivityAt,
  lastActivityLabel,
  recentFeedItems = [],
  onLogActivity,
  onViewAllActivities,
}: LeadSummaryCardProps) {
  const masterName = customerName?.trim() || null
  const nextFollowUp = lead.nextFollowUpDate
    ? formatDate(lead.nextFollowUpDate)
    : null
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const activityCount = recentFeedItems.length

  return (
    <section className="lead-summary-card" id="lead-section-summary" aria-label="Lead Summary">
      <header className="lead-summary-card__head">
        <div>
          <h2 className="lead-summary-card__title">Lead Summary</h2>
          <p className="lead-summary-card__subtitle">
            Company, contact, ownership, status, and recent activity.
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
            {lead.customerId ? (
              <ErpViewField label="Company / Prospect" emptyLabel={EMPTY} className="lead-summary-card__field--primary">
                <AppLink to={entity360CustomerPath(lead.customerId)} className="erp-view-field__link">
                  {lead.prospectName}
                </AppLink>
              </ErpViewField>
            ) : (
              <ErpViewField
                label="Company / Prospect"
                value={lead.prospectName}
                emptyLabel={EMPTY}
                className="lead-summary-card__field--primary"
              />
            )}
            <ErpViewField label="Customer Master" emptyLabel={EMPTY}>
              {lead.customerId && masterName ? (
                <AppLink to={entity360CustomerPath(lead.customerId)} className="erp-view-field__link">
                  {masterName}
                </AppLink>
              ) : undefined}
            </ErpViewField>
            <ErpViewField label="Industry" value={lead.industry} emptyLabel={EMPTY} />

            <ErpViewField label="Contact Person" value={lead.contactPerson} emptyLabel={EMPTY} />
            <ErpViewPhone label="Mobile" value={lead.mobile} emptyLabel={EMPTY} />
            <ErpViewEmail label="Email" value={lead.email} emptyLabel={EMPTY} />
            <ErpViewField label="Designation" value={designation} emptyLabel={EMPTY} />

            <ErpViewField label="Lead Owner" value={lead.leadOwnerName} emptyLabel={EMPTY} />
            <ErpViewField label="Lead Source" value={formatStatus(lead.source)} emptyLabel={EMPTY} />
            <ErpViewField label="Priority" value={leadPriorityLabel(lead.priority)} emptyLabel={EMPTY} />
            <ErpViewField label="Created Date" value={formatDate(lead.createdDate)} emptyLabel={EMPTY} />

            <ErpViewField label="Lead Stage" emptyLabel={EMPTY}>
              <LeadStageChip stage={lead.stage} />
            </ErpViewField>
            <ErpViewField label="Qualification Status" value={leadQualificationLabel(lead)} emptyLabel={EMPTY} />
            <ErpViewField label="Next Follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
            <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />

            {lead.externalSource === 'INDIAMART' && (
              <>
                <ErpViewField label="IndiaMART Enquiry ID" value={lead.externalSourceId} emptyLabel={EMPTY} />
                <ErpViewField
                  label="Enquiry Received"
                  value={lead.sourceEnquiryDate ? formatDate(lead.sourceEnquiryDate) : null}
                  emptyLabel={EMPTY}
                />
                {lead.integrationEnquiryId && (
                  <ErpViewField label="Integration Inbox" emptyLabel={EMPTY}>
                    <a className="text-erp-primary underline" href="/crm/integrations/indiamart/inbox">
                      Open IndiaMART inbox
                    </a>
                  </ErpViewField>
                )}
              </>
            )}
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
