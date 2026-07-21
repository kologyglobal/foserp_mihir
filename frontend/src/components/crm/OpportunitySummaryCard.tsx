import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Banknote, Building2, CalendarClock, UserRound } from 'lucide-react'
import type { Opportunity } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { opportunityPriorityLabel, opportunityStageLabel } from '@/utils/opportunityUtils'
import { opportunityRequirementDisplay } from '@/utils/leadRequirementLines'

const EMPTY = '—'

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
}

function SummaryGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section className="lead-summary-card__group" aria-label={title}>
      <header className="lead-summary-card__group-head">
        <span className="lead-summary-card__group-icon" aria-hidden>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <h3 className="lead-summary-card__group-title">{title}</h3>
      </header>
      <div className="lead-summary-card__fields">{children}</div>
    </section>
  )
}

function stageTone(stage: string): 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'pending' {
  if (stage === 'won') return 'success'
  if (stage === 'lost') return 'critical'
  if (stage === 'on_hold') return 'warning'
  return 'info'
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
}: OpportunitySummaryCardProps) {
  const nextFollowUp = opportunity.nextFollowUpDate
    ? formatDate(opportunity.nextFollowUpDate)
    : null
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const resolvedCustomerId = customerId ?? opportunity.customerId

  return (
    <section className="lead-summary-card" id="opp-section-summary" aria-label="Opportunity Summary">
      <header className="lead-summary-card__head">
        <div>
          <h2 className="lead-summary-card__title">Opportunity Summary</h2>
          <p className="lead-summary-card__subtitle">
            Customer, contact, ownership, and deal status at a glance.
          </p>
        </div>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Customer" icon={Building2}>
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
        </SummaryGroup>

        <SummaryGroup title="Primary Contact" icon={UserRound}>
          <ErpViewField label="Contact Person" value={contactName} emptyLabel={EMPTY} />
          <ErpViewPhone label="Mobile" value={contactPhone} emptyLabel={EMPTY} />
          <ErpViewEmail label="Email" value={contactEmail} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Ownership" icon={Banknote}>
          <ErpViewField label="Owner" value={opportunity.ownerName} emptyLabel={EMPTY} />
          <ErpViewField label="Priority" value={opportunityPriorityLabel(opportunity.priority)} emptyLabel={EMPTY} />
          <ErpViewField label="Created Date" value={formatDate(opportunity.createdAt)} emptyLabel={EMPTY} />
          <ErpViewField
            label={dealValueLabel}
            value={formatCrmCurrency(dealValue ?? opportunity.value)}
            hint={dealValueHint}
            emptyLabel={EMPTY}
          />
        </SummaryGroup>

        <SummaryGroup title="Status" icon={CalendarClock}>
          <ErpViewField label="Stage" emptyLabel={EMPTY}>
            <DynamicsStatusChip
              label={opportunityStageLabel(opportunity.stage)}
              tone={stageTone(opportunity.stage)}
            />
          </ErpViewField>
          <ErpViewField label="Status" value={opportunity.status} emptyLabel={EMPTY} />
          <ErpViewField label="Next Follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
        </SummaryGroup>
      </div>
    </section>
  )
}
