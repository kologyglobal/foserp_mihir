import type { ReactNode } from 'react'
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

export interface LeadSummaryCardProps {
  lead: Lead
  customerName?: string | null
  designation?: string | null
  lastActivityAt?: string | null
  lastActivityLabel?: string | null
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

export function resolveLeadContactDesignation(
  lead: Lead,
  contacts: CrmContact[],
): string | null {
  if (!contacts.length) return null
  const phone = lead.mobile?.replace(/\D/g, '')
  const email = lead.email?.trim().toLowerCase()
  const name = lead.contactPerson?.trim().toLowerCase()
  const pool = lead.customerId
    ? contacts.filter((c) => c.customerId === lead.customerId)
    : contacts
  const match =
    pool.find((c) => email && c.email?.trim().toLowerCase() === email)
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
        <h2 className="lead-summary-card__title">Lead Summary</h2>
        <p className="lead-summary-card__subtitle">Company, contact, ownership, and status at a glance.</p>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Company">
          {lead.customerId ? (
            <ErpViewField label="Company / Prospect">
              <AppLink to={entity360CustomerPath(lead.customerId)} className="erp-view-field__link">
                {lead.prospectName}
              </AppLink>
            </ErpViewField>
          ) : (
            <ErpViewField label="Company / Prospect" value={lead.prospectName} />
          )}
          <ErpViewField label="Customer Master">
            {lead.customerId && masterName ? (
              <AppLink to={entity360CustomerPath(lead.customerId)} className="erp-view-field__link">
                {masterName}
              </AppLink>
            ) : undefined}
          </ErpViewField>
          <ErpViewField label="Industry" value={lead.industry} />
        </SummaryGroup>

        <SummaryGroup title="Primary Contact">
          <ErpViewField label="Contact Person" value={lead.contactPerson} />
          <ErpViewPhone label="Mobile" value={lead.mobile} />
          <ErpViewEmail label="Email" value={lead.email} />
          <ErpViewField label="Designation" value={designation} />
        </SummaryGroup>

        <SummaryGroup title="Ownership">
          <ErpViewField label="Lead Owner" value={lead.leadOwnerName} />
          <ErpViewField label="Lead Source" value={formatStatus(lead.source)} />
          <ErpViewField label="Priority" value={leadPriorityLabel(lead.priority)} />
          <ErpViewField label="Created Date" value={formatDate(lead.createdDate)} />
        </SummaryGroup>

        <SummaryGroup title="Status">
          <ErpViewField label="Lead Stage">
            <LeadStageChip stage={lead.stage} />
          </ErpViewField>
          <ErpViewField label="Qualification Status" value={leadQualificationLabel(lead)} />
          <ErpViewField label="Next Follow-up" value={nextFollowUp} />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} />
        </SummaryGroup>
      </div>
    </section>
  )
}
