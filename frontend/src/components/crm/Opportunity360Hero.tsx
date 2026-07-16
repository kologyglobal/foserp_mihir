import {
  Building2, Calendar, User, TrendingUp, Target, Phone, Mail,
} from 'lucide-react'
import type { Opportunity } from '../../types/crm'
import { opportunityStageLabel, opportunityPriorityLabel } from '../../utils/opportunityUtils'
import type { Customer } from '../../types/master'
import type { CrmContact } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { HealthScoreRing } from './Opportunity360Sections'
import { cn } from '../../utils/cn'

const STAGE_TONE: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'live' | 'pending' | 'neutral'> = {
  won: 'success',
  lost: 'critical',
  on_hold: 'warning',
  negotiation: 'live',
  quotation_sent: 'pending',
}

export function Opportunity360Hero({
  opportunity,
  customer,
  contact,
  weighted,
  onOpenCustomer,
}: {
  opportunity: Opportunity
  customer?: Customer
  contact?: CrmContact | null
  weighted: number
  onOpenCustomer?: () => void
}) {
  const overdueFu =
    opportunity.nextFollowUpDate &&
    opportunity.nextFollowUpDate.slice(0, 10) < new Date().toISOString().slice(0, 10)

  return (
    <section className="opp-360-hero" aria-label="Deal profile">
      <div className="opp-360-hero__glow" aria-hidden />
      <div className="opp-360-hero__inner">
        <div className="opp-360-hero__identity">
          <div className="opp-360-hero__icon" aria-hidden>
            <Target className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="opp-360-hero__badges">
              <DynamicsStatusChip label={opportunityStageLabel(opportunity.stage)} tone={STAGE_TONE[opportunity.stage] ?? 'info'} />
              <span className="opp-360-hero__priority">{opportunityPriorityLabel(opportunity.priority)}</span>
              {overdueFu ? <DynamicsStatusChip label="Overdue F/U" tone="critical" /> : null}
            </div>
            <h2 className="opp-360-hero__name">{opportunity.opportunityName}</h2>
            <p className="opp-360-hero__code">{opportunity.opportunityNo}</p>
            <div className="opp-360-hero__meta">
              {customer ? (
                <button type="button" className="opp-360-hero__meta-link" onClick={onOpenCustomer}>
                  <Building2 className="h-3.5 w-3.5" />
                  {customer.customerName}
                </button>
              ) : null}
              <span>
                <User className="h-3.5 w-3.5" />
                {opportunity.ownerName}
              </span>
              <span>
                <Calendar className="h-3.5 w-3.5" />
                Close{' '}
                {new Date(opportunity.expectedCloseDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="opp-360-hero__commercial">
          <div className="opp-360-hero__metric">
            <p className="opp-360-hero__metric-label">Deal value</p>
            <p className="opp-360-hero__metric-value">{formatCrmCurrency(opportunity.value)}</p>
            <p className="opp-360-hero__metric-hint">{opportunity.probability}% win probability</p>
          </div>
          <div className="opp-360-hero__metric">
            <p className="opp-360-hero__metric-label">Weighted forecast</p>
            <p className="opp-360-hero__metric-value">
              <TrendingUp className="mr-1 inline h-4 w-4 opacity-80" />
              {formatCrmCurrency(weighted)}
            </p>
          </div>
          <div className="opp-360-hero__health">
            <HealthScoreRing score={opportunity.healthScore} size={72} variant="light" />
          </div>
        </div>

        {(contact || customer) ? (
          <div className="opp-360-hero__contact-card">
            <p className="opp-360-hero__contact-title">
              <User className="h-4 w-4" />
              Primary contact
            </p>
            <p className="opp-360-hero__contact-name">{contact?.name ?? customer?.contactPerson ?? '—'}</p>
            <div className="opp-360-hero__contact-lines">
              {(contact?.phone ?? customer?.contactPhone) ? (
                <button
                  type="button"
                  className="opp-360-hero__contact-link"
                  onClick={() => window.open(`tel:${contact?.phone ?? customer?.contactPhone}`)}
                >
                  <Phone className="h-3.5 w-3.5" />
                  {contact?.phone ?? customer?.contactPhone}
                </button>
              ) : null}
              {(contact?.email ?? customer?.contactEmail) ? (
                <button
                  type="button"
                  className="opp-360-hero__contact-link"
                  onClick={() => window.open(`mailto:${contact?.email ?? customer?.contactEmail}`)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {contact?.email ?? customer?.contactEmail}
                </button>
              ) : null}
            </div>
            {contact?.designation ? (
              <p className={cn('opp-360-hero__designation')}>{contact.designation}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
