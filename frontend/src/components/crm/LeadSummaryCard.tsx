import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Building2, CalendarClock, UserRound, Users } from 'lucide-react'
import type { Lead } from '@/types/sales'
import type { CrmContact } from '@/types/crm'
import { AppLink } from '@/components/ui/AppLink'
import { LeadStageChip } from '@/components/crm/LeadStageChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { formatStatus } from '@/components/ui/Badge'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { leadPriorityLabel } from '@/utils/leadUtils'
import { leadQualificationLabel } from '@/utils/lead360Utils'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { normalizeEmail } from '@/utils/validation/email'

const EMPTY = '—'

export interface LeadSummaryCardProps {
  lead: Lead
  customerName?: string | null
  designation?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
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
}: LeadSummaryCardProps) {
  const masterName = customerName?.trim() || null
  const nextFollowUp = lead.nextFollowUpDate
    ? formatDate(lead.nextFollowUpDate)
    : null
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null

  return (
    <section className="lead-summary-card" id="lead-section-summary" aria-label="Lead Summary">
      <header className="lead-summary-card__head">
        <div>
          <h2 className="lead-summary-card__title">Lead Summary</h2>
          <p className="lead-summary-card__subtitle">
            Company, contact, ownership, and status at a glance.
          </p>
        </div>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Company" icon={Building2}>
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
        </SummaryGroup>

        <SummaryGroup title="Primary Contact" icon={UserRound}>
          <ErpViewField label="Contact Person" value={lead.contactPerson} emptyLabel={EMPTY} />
          <ErpViewPhone label="Mobile" value={lead.mobile} emptyLabel={EMPTY} />
          <ErpViewEmail label="Email" value={lead.email} emptyLabel={EMPTY} />
          <ErpViewField label="Designation" value={designation} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Ownership" icon={Users}>
          <ErpViewField label="Lead Owner" value={lead.leadOwnerName} emptyLabel={EMPTY} />
          <ErpViewField label="Lead Source" value={formatStatus(lead.source)} emptyLabel={EMPTY} />
          <ErpViewField label="Priority" value={leadPriorityLabel(lead.priority)} emptyLabel={EMPTY} />
          <ErpViewField label="Created Date" value={formatDate(lead.createdDate)} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Status" icon={CalendarClock}>
          <ErpViewField label="Lead Stage" emptyLabel={EMPTY}>
            <LeadStageChip stage={lead.stage} />
          </ErpViewField>
          <ErpViewField label="Qualification Status" value={leadQualificationLabel(lead)} emptyLabel={EMPTY} />
          <ErpViewField label="Next Follow-up" value={nextFollowUp} emptyLabel={EMPTY} />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
        </SummaryGroup>
      </div>
    </section>
  )
}
