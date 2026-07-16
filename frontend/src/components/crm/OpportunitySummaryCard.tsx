import type { ReactNode } from 'react'
import type { Opportunity } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { opportunityPriorityLabel, opportunityStageLabel } from '@/utils/opportunityUtils'
import { opportunityRequirementDisplay } from '@/utils/leadRequirementLines'

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
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="lead-summary-card__group" aria-label={title}>
      <h3 className="lead-summary-card__group-title">{title}</h3>
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
        <h2 className="lead-summary-card__title">Opportunity Summary</h2>
        <p className="lead-summary-card__subtitle">
          Customer, contact, ownership, and deal status at a glance.
        </p>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Customer">
          <ErpViewField label="Opportunity Name" value={opportunity.opportunityName} />
          <ErpViewField label="Customer">
            {resolvedCustomerId && customerName ? (
              <AppLink to={entity360CustomerPath(resolvedCustomerId)} className="erp-view-field__link">
                {customerName}
              </AppLink>
            ) : undefined}
          </ErpViewField>
          <ErpViewField label="City" value={city} />
          <ErpViewField label="Product Requirement" value={opportunityRequirementDisplay(opportunity.productRequirement)} />
          {productName ? (
            <ErpViewField label="Linked Product" value={productName} />
          ) : null}
        </SummaryGroup>

        <SummaryGroup title="Primary Contact">
          <ErpViewField label="Contact Person" value={contactName} />
          <ErpViewPhone label="Mobile" value={contactPhone} />
          <ErpViewEmail label="Email" value={contactEmail} />
        </SummaryGroup>

        <SummaryGroup title="Ownership">
          <ErpViewField label="Owner" value={opportunity.ownerName} />
          <ErpViewField label="Priority" value={opportunityPriorityLabel(opportunity.priority)} />
          <ErpViewField label="Created Date" value={formatDate(opportunity.createdAt)} />
          <ErpViewField
            label={dealValueLabel}
            value={formatCrmCurrency(dealValue ?? opportunity.value)}
            hint={dealValueHint}
          />
        </SummaryGroup>

        <SummaryGroup title="Status">
          <ErpViewField label="Stage">
            <DynamicsStatusChip
              label={opportunityStageLabel(opportunity.stage)}
              tone={stageTone(opportunity.stage)}
            />
          </ErpViewField>
          <ErpViewField label="Status" value={opportunity.status} />
          <ErpViewField label="Next Follow-up" value={nextFollowUp} />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} />
        </SummaryGroup>
      </div>
    </section>
  )
}
