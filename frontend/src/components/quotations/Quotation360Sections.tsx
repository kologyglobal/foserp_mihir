import {
  Building2,
  Calendar,
  User,
  FileText,
  Lock,
  Layers,
  AlertCircle,
  Handshake,
  Package,
} from 'lucide-react'
import type { QuotationDocument, QuotationDocumentStatus } from '../../types/crm'
import type { Customer } from '../../types/master'
import type { Quotation } from '../../types/sales'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { calcPriceSummary } from '../../utils/crmQuotationCalc'
import { formatDate } from '../../utils/dates/format'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { quotationStatusLabel, quotationStatusTone } from './QuotationCrmCard'
import { cn } from '../../utils/cn'

const WORKFLOW_STEPS: { id: QuotationDocumentStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'pending_approval', label: 'Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'converted', label: 'Converted' },
]

function workflowIndex(status: QuotationDocumentStatus): number {
  if (status === 'rejected') return 2
  return WORKFLOW_STEPS.findIndex((s) => s.id === status)
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function QuotationHeroCard({
  document: doc,
  quotation,
  customer,
  productName,
  opportunity,
  contact,
  revisionCount,
  onOpenCustomer,
  onOpenOpportunity,
}: {
  document: QuotationDocument
  quotation: Quotation
  customer?: Customer
  productName?: string
  opportunity?: { opportunityNo: string; opportunityName?: string }
  contact?: { name: string }
  revisionCount: number
  onOpenCustomer?: () => void
  onOpenOpportunity?: () => void
}) {
  const validitySoon = quotation.validityDate
    && quotation.validityDate.slice(0, 10) < new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const ownerName = doc.salesOwnerName ?? contact?.name ?? customer?.contactPerson
  const displayContact = contact?.name ?? customer?.contactPerson

  return (
    <section className="quotation-360-hero" aria-label="Quotation overview">
      <div className="quotation-360-hero__glow" aria-hidden />

      <div className="quotation-360-hero__inner">
        <div className="quotation-360-hero__identity">
          <div className="quotation-360-hero__avatar" aria-hidden>
            {customer ? initials(customer.customerName) : 'Q'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="quotation-360-hero__badges">
              <LiveStatusBadge label={quotationStatusLabel(doc.status)} tone={quotationStatusTone(doc.status)} size="md" pulse={false} />
              <span className="quotation-360-hero__rev">Rev {doc.revisionNo}</span>
              {doc.locked ? (
                <span className="quotation-360-hero__flag quotation-360-hero__flag--warn">
                  <Lock className="h-3 w-3" aria-hidden />
                  Locked
                </span>
              ) : null}
              {validitySoon ? (
                <span className="quotation-360-hero__flag quotation-360-hero__flag--warn">Validity ending soon</span>
              ) : null}
            </div>

            {customer ? (
              <button
                type="button"
                onClick={onOpenCustomer}
                className="quotation-360-hero__customer group"
              >
                <span className="quotation-360-hero__name">{customer.customerName}</span>
                <span className="quotation-360-hero__location">· {customer.city}</span>
              </button>
            ) : (
              <h2 className="quotation-360-hero__name">{quotation.quotationNo}</h2>
            )}

            <p className="quotation-360-hero__subtitle">
              <span className="font-mono">{quotation.quotationNo}</span>
              {quotation.inquiryNo ? <span> · {quotation.inquiryNo}</span> : null}
              {productName ? <span> · {productName}</span> : null}
            </p>

            <div className="quotation-360-hero__chips">
              {displayContact ? (
                <span className="quotation-360-hero__chip">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  {displayContact}
                </span>
              ) : null}
              {quotation.validityDate ? (
                <span className={cn('quotation-360-hero__chip', validitySoon && 'quotation-360-hero__chip--warn')}>
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  Valid till {formatDate(quotation.validityDate)}
                </span>
              ) : null}
              <span className="quotation-360-hero__chip">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                {doc.sections.length} sections · {revisionCount} revision{revisionCount !== 1 ? 's' : ''}
              </span>
              {doc.priceLines.length > 0 ? (
                <span className="quotation-360-hero__chip">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  {doc.priceLines.length} line item{doc.priceLines.length !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="quotation-360-hero__aside">
          {opportunity ? (
            <div className="quotation-360-hero__deal-card">
              <p className="quotation-360-hero__deal-title">
                <Handshake className="h-4 w-4" aria-hidden />
                Linked opportunity
              </p>
              <button
                type="button"
                onClick={onOpenOpportunity}
                className="quotation-360-hero__deal-link"
              >
                {opportunity.opportunityName ?? opportunity.opportunityNo}
              </button>
              <p className="quotation-360-hero__deal-meta">{opportunity.opportunityNo}</p>
            </div>
          ) : (
            <div className="quotation-360-hero__deal-card">
              <p className="quotation-360-hero__deal-title">
                <FileText className="h-4 w-4" aria-hidden />
                Document owner
              </p>
              <p className="quotation-360-hero__deal-link quotation-360-hero__deal-link--static">
                {ownerName ?? 'Unassigned'}
              </p>
              {customer ? (
                <p className="quotation-360-hero__deal-meta">
                  <Building2 className="inline h-3.5 w-3.5" aria-hidden />
                  {' '}
                  {customer.customerType}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function QuotationWorkflowStepper({ status }: { status: QuotationDocumentStatus }) {
  const idx = workflowIndex(status)
  const isRejected = status === 'rejected'

  return (
    <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Document workflow</p>
          <p className="mt-0.5 text-[14px] font-bold text-erp-text">
            {isRejected ? 'Rejected — revision required' : `Step ${idx + 1} of ${WORKFLOW_STEPS.length}`}
          </p>
        </div>
        <LiveStatusBadge label={quotationStatusLabel(status)} tone={quotationStatusTone(status)} pulse={false} />
      </div>

      {isRejected ? (
        <div className="flex items-start gap-2 rounded-lg border border-erp-danger/30 bg-erp-danger-soft/30 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-erp-danger" />
          <p className="text-[13px] text-erp-danger-fg">Create a new revision to address feedback and resubmit for approval.</p>
        </div>
      ) : (
        <div className="flex gap-1">
          {WORKFLOW_STEPS.map((s, i) => {
            const isCurrent = s.id === status
            const isPast = i < idx
            return (
              <div key={s.id} className="group flex flex-1 flex-col items-center gap-1.5 rounded-md px-0.5 py-1">
                <div className="flex w-full items-center gap-0.5">
                  <div
                    className={cn(
                      'h-2 flex-1 rounded-full transition-all',
                      isPast ? 'bg-erp-primary' : isCurrent ? 'bg-erp-primary ring-2 ring-erp-primary/30 ring-offset-1' : 'bg-erp-surface-alt',
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-center text-[8px] font-medium leading-tight text-erp-muted sm:text-[9px]',
                    isCurrent && 'font-bold text-erp-primary',
                    isPast && 'text-erp-text',
                  )}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function QuotationCommercialSummary({ document: doc }: { document: QuotationDocument }) {
  const summary = calcPriceSummary(doc.priceLines, doc.freightAmount, doc.installationAmount, doc.customCharges)

  const rows = [
    { label: 'Basic amount', value: summary.basicAmount },
    { label: 'Discount', value: -summary.discountAmount, muted: true },
    { label: 'Taxable value', value: summary.taxableValue },
    { label: 'GST', value: summary.gstAmount },
    ...(doc.freightAmount > 0 ? [{ label: 'Freight', value: doc.freightAmount }] : []),
    ...(doc.installationAmount > 0 ? [{ label: 'Installation', value: doc.installationAmount }] : []),
    ...(doc.customCharges > 0 ? [{ label: 'Custom charges', value: doc.customCharges }] : []),
  ]

  return (
    <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Commercial summary</p>
      <dl className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[13px]">
            <dt className={cn('text-erp-muted', 'muted' in r && r.muted && 'text-erp-warning')}>{r.label}</dt>
            <dd className={cn('font-medium tabular-nums text-erp-text', 'muted' in r && r.muted && 'text-erp-warning')}>
              {formatCrmCurrency(Math.abs(r.value))}
              {'muted' in r && r.muted ? ' (−)' : ''}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-erp-border pt-2">
          <dt className="text-[14px] font-bold text-erp-text">Grand total</dt>
          <dd className="text-[18px] font-bold tabular-nums text-erp-primary">{formatCrmCurrency(summary.grandTotal)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-erp-muted">{doc.priceLines.length} line items</p>
    </div>
  )
}

export function QuotationSectionList({ document: doc }: { document: QuotationDocument }) {
  const sorted = [...doc.sections].sort((a, b) => a.sequenceNo - b.sequenceNo)

  return (
    <div className="space-y-2">
      {sorted.map((sec, i) => (
        <div
          key={sec.id}
          className="flex items-start gap-3 rounded-lg border border-erp-border bg-erp-surface px-4 py-3 transition-colors hover:border-erp-primary/20"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-erp-primary-soft text-[11px] font-bold text-erp-primary">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-erp-text">{sec.title}</p>
              <span className="rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-medium uppercase text-erp-muted">
                {sec.sectionType.replace(/_/g, ' ')}
              </span>
              {!sec.editable ? (
                <span className="text-[10px] text-erp-muted">Read-only</span>
              ) : null}
            </div>
            {sec.content ? (
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-erp-muted">{sec.content}</p>
            ) : (
              <p className="mt-1 text-[12px] italic text-erp-muted">No content yet</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
