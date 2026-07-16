import type { ReactNode } from 'react'
import type { QuotationDocument } from '@/types/crm'
import type { Quotation } from '@/types/sales'
import { AppLink } from '@/components/ui/AppLink'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { ErpViewField, ErpViewPhone, ErpViewEmail } from '@/components/erp/card-form'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { quotationStatusLabel } from './QuotationCrmCard'

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
        <h2 className="lead-summary-card__title">Quotation Summary</h2>
        <p className="lead-summary-card__subtitle">
          Customer, commercial totals, and document status at a glance.
        </p>
      </header>

      <div className="lead-summary-card__grid">
        <SummaryGroup title="Customer">
          <ErpViewField label="Quotation No." value={quotation.quotationNo} />
          <ErpViewField label="Customer">
            {resolvedCustomerId && customerName ? (
              <AppLink to={entity360CustomerPath(resolvedCustomerId)} className="erp-view-field__link">
                {customerName}
              </AppLink>
            ) : undefined}
          </ErpViewField>
          <ErpViewField label="City" value={city} />
          {productName ? <ErpViewField label="Product" value={productName} /> : null}
          {opportunityId && opportunityNo ? (
            <ErpViewField label="Opportunity">
              <AppLink to={`/crm/opportunities/${opportunityId}`} className="erp-view-field__link">
                {opportunityNo}
              </AppLink>
            </ErpViewField>
          ) : (
            <ErpViewField label="Inquiry" value={quotation.inquiryNo} />
          )}
        </SummaryGroup>

        <SummaryGroup title="Primary Contact">
          <ErpViewField label="Contact Person" value={contactName} />
          <ErpViewPhone label="Mobile" value={contactPhone} />
          <ErpViewEmail label="Email" value={contactEmail} />
        </SummaryGroup>

        <SummaryGroup title="Ownership">
          <ErpViewField label="Owner" value={document.salesOwnerName} />
          <ErpViewField label="Revision" value={`R${document.revisionNo}`} />
          <ErpViewField label="Created Date" value={formatDate(quotation.createdAt)} />
          <ErpViewField label="Grand Total" value={formatCrmCurrency(document.totalAmount)} />
        </SummaryGroup>

        <SummaryGroup title="Status">
          <ErpViewField label="Document Status">
            <DynamicsStatusChip
              label={quotationStatusLabel(document.status)}
              tone={statusTone(document.status)}
            />
          </ErpViewField>
          <ErpViewField
            label="Valid Until"
            value={quotation.validityDate ? formatDate(quotation.validityDate) : undefined}
          />
          <ErpViewField
            label="Customer Approval"
            value={quotation.customerApproval?.replace(/_/g, ' ')}
          />
          <ErpViewField label="Last Activity" value={lastActivityDisplay} />
        </SummaryGroup>
      </div>
    </section>
  )
}
