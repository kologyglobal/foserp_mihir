import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Banknote, Building2, CalendarClock, UserRound } from 'lucide-react'
import type { QuotationDocument } from '@/types/crm'
import type { Quotation } from '@/types/sales'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { quotationStatusLabel } from './QuotationCrmCard'

const EMPTY = '—'

export interface QuotationSummaryCardProps {
  quotation: Quotation
  document: QuotationDocument
  customerName?: string | null
  customerId?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  city?: string | null
  productName?: string | null
  opportunityNo?: string | null
  opportunityId?: string | null
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

function statusTone(
  status: string,
): 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'pending' {
  if (status === 'approved' || status === 'converted') return 'success'
  if (status === 'rejected') return 'critical'
  if (status === 'pending_approval') return 'pending'
  if (status === 'sent') return 'info'
  return 'neutral'
}

export function QuotationSummaryCard({
  quotation,
  document,
  customerName,
  customerId,
  contactName,
  contactPhone,
  contactEmail,
  city,
  productName,
  opportunityNo,
  opportunityId,
  lastActivityAt,
  lastActivityLabel,
}: QuotationSummaryCardProps) {
  const lastActivityDisplay = lastActivityAt
    ? `${formatDateTime(lastActivityAt)}${lastActivityLabel ? ` · ${lastActivityLabel}` : ''}`
    : null
  const resolvedCustomerId = customerId ?? quotation.customerId

  return (
    <section className="lead-summary-card" id="quo-section-summary" aria-label="Quotation Summary">
      <header className="lead-summary-card__head">
        <div>
          <h2 className="lead-summary-card__title">Quotation Summary</h2>
          <p className="lead-summary-card__subtitle">
            Customer, commercial totals, and document status at a glance.
          </p>
        </div>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Customer" icon={Building2}>
          <ErpViewField
            label="Quotation No."
            value={quotation.quotationNo}
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
          {productName ? <ErpViewField label="Product" value={productName} emptyLabel={EMPTY} /> : null}
          {opportunityId && opportunityNo ? (
            <ErpViewField label="Opportunity" emptyLabel={EMPTY}>
              <AppLink to={`/crm/opportunities/${opportunityId}`} className="erp-view-field__link">
                {opportunityNo}
              </AppLink>
            </ErpViewField>
          ) : (
            <ErpViewField label="Inquiry" value={quotation.inquiryNo} emptyLabel={EMPTY} />
          )}
        </SummaryGroup>

        <SummaryGroup title="Primary Contact" icon={UserRound}>
          <ErpViewField label="Contact Person" value={contactName} emptyLabel={EMPTY} />
          <ErpViewPhone label="Mobile" value={contactPhone} emptyLabel={EMPTY} />
          <ErpViewEmail label="Email" value={contactEmail} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Ownership" icon={Banknote}>
          <ErpViewField label="Owner" value={document.salesOwnerName} emptyLabel={EMPTY} />
          <ErpViewField label="Revision" value={`R${document.revisionNo}`} emptyLabel={EMPTY} />
          <ErpViewField label="Created Date" value={formatDate(quotation.createdAt)} emptyLabel={EMPTY} />
          <ErpViewField label="Grand Total" value={formatCrmCurrency(document.totalAmount)} emptyLabel={EMPTY} />
        </SummaryGroup>

        <SummaryGroup title="Status" icon={CalendarClock}>
          <ErpViewField label="Document Status" emptyLabel={EMPTY}>
            <DynamicsStatusChip
              label={quotationStatusLabel(document.status)}
              tone={statusTone(document.status)}
            />
          </ErpViewField>
          <ErpViewField
            label="Valid Until"
            value={quotation.validityDate ? formatDate(quotation.validityDate) : undefined}
            emptyLabel={EMPTY}
          />
          <ErpViewField
            label="Customer Approval"
            value={quotation.customerApproval?.replace(/_/g, ' ')}
            emptyLabel={EMPTY}
          />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} emptyLabel={EMPTY} />
        </SummaryGroup>
      </div>
    </section>
  )
}
