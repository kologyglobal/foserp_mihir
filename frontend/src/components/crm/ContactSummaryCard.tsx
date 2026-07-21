import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Building2, CalendarClock, Phone, UserRound } from 'lucide-react'
import type { CrmContact } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatDate, formatDateTime } from '@/utils/dates/format'

const EMPTY = '—'

export interface ContactSummaryCardProps {
  contact: CrmContact
  customerName?: string | null
  customerCode?: string | null
  city?: string | null
  territory?: string | null
  industry?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
  nextFollowUpDate?: string | null
  openOpportunityCount?: number
}

function SummaryGroup({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  id?: string
}) {
  return (
    <section className="lead-summary-card__group" aria-label={title} id={id}>
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

export function ContactSummaryCard({
  contact,
  customerName,
  customerCode,
  city,
  territory,
  industry,
  lastActivityAt,
  lastActivityLabel,
  nextFollowUpDate,
  openOpportunityCount = 0,
}: ContactSummaryCardProps) {
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const nextFollowUp = nextFollowUpDate ? formatDate(nextFollowUpDate) : null
  const isActive = contact.isActive !== false

  return (
    <section
      className="lead-summary-card contact-summary-card"
      id="contact-section-profile"
      aria-label="Contact Summary"
    >
      <header className="lead-summary-card__head">
        <div className="contact-summary-card__identity">
          <div className="contact-summary-card__avatar" aria-hidden>
            {contact.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join('') || '?'}
          </div>
          <div>
            <h2 className="lead-summary-card__title">Contact Summary</h2>
            <p className="lead-summary-card__subtitle">
              Identity, reach, company link, and engagement status at a glance.
            </p>
          </div>
        </div>
        <div className="contact-summary-card__badges">
          {contact.isPrimary ? (
            <DynamicsStatusChip label="Primary" tone="success" />
          ) : (
            <DynamicsStatusChip label="Secondary" tone="neutral" />
          )}
          <DynamicsStatusChip
            label={isActive ? 'Active' : 'Inactive'}
            tone={isActive ? 'info' : 'neutral'}
          />
        </div>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Identity" icon={UserRound}>
          <ErpViewField
            label="Full Name"
            value={contact.name}
            emptyLabel={EMPTY}
            className="lead-summary-card__field--primary"
          />
          <ErpViewField label="Contact Code" value={contact.contactCode} emptyLabel={EMPTY} />
          <ErpViewField label="Designation" value={contact.designation} emptyLabel={EMPTY} />
          <ErpViewField label="Department" value={contact.department} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Reach" icon={Phone}>
          <ErpViewEmail label="Email" value={contact.email} emptyLabel={EMPTY} />
          <ErpViewPhone label="Phone" value={contact.phone} emptyLabel={EMPTY} />
          <ErpViewField label="Primary Contact" emptyLabel={EMPTY}>
            <DynamicsStatusChip
              label={contact.isPrimary ? 'Yes — primary' : 'No — secondary'}
              tone={contact.isPrimary ? 'success' : 'neutral'}
            />
          </ErpViewField>
        </SummaryGroup>

        <SummaryGroup title="Company" icon={Building2} id="contact-section-company">
          <ErpViewField
            label="Company"
            emptyLabel={EMPTY}
            className="lead-summary-card__field--primary"
          >
            {contact.customerId && customerName ? (
              <AppLink to={entity360CustomerPath(contact.customerId)} className="erp-view-field__link">
                {customerName}
              </AppLink>
            ) : undefined}
          </ErpViewField>
          <ErpViewField label="Company Code" value={customerCode} emptyLabel={EMPTY} />
          <ErpViewField label="City" value={city} emptyLabel={EMPTY} />
          <ErpViewField label="Territory" value={territory} emptyLabel={EMPTY} />
          {industry ? <ErpViewField label="Industry" value={industry} emptyLabel={EMPTY} /> : null}
        </SummaryGroup>

        <SummaryGroup title="Engagement Status" icon={CalendarClock}>
          <ErpViewField label="Record Status" emptyLabel={EMPTY}>
            <DynamicsStatusChip
              label={isActive ? 'Active' : 'Inactive'}
              tone={isActive ? 'info' : 'neutral'}
            />
          </ErpViewField>
          <ErpViewField
            label="Open Opportunities"
            value={String(openOpportunityCount)}
            emptyLabel={EMPTY}
          />
          <ErpViewField label="Next Follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
        </SummaryGroup>
      </div>
    </section>
  )
}
