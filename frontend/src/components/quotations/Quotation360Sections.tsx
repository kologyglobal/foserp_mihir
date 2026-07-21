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

import type { CustomerApprovalStatus } from '../../types/quotation'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'
import { resolveQuotationRevisionPolicy } from '../../utils/quotationRevisionPolicy'

type WorkflowStepId =
  | 'draft'
  | 'submit'
  | 'send'
  | 'sent'
  | 'customer_approved'
  | 'convert'

const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'submit', label: 'Submit for Internal Approval' },
  { id: 'send', label: 'Send to Customer' },
  { id: 'sent', label: 'Sent' },
  { id: 'customer_approved', label: 'Customer Approved' },
  { id: 'convert', label: 'Convert to Sales Order' },
]

function resolveCurrentStepId(
  status: QuotationDocumentStatus,
  customerApproval?: CustomerApprovalStatus | null,
): WorkflowStepId {
  if (status === 'converted') return 'convert'
  if (status === 'sent' && customerApproval === 'approved') return 'customer_approved'
  if (status === 'sent') return 'sent'
  if (status === 'approved') return 'send'
  if (status === 'pending_approval') return 'submit'
  if (status === 'rejected') return 'draft'
  if (status === 'draft' || status === 'superseded') return 'draft'
  return 'draft'
}

/** Index of the active / next-action step (0-based). */
function workflowIndex(
  status: QuotationDocumentStatus,
  customerApproval?: CustomerApprovalStatus | null,
): number {
  const id = resolveCurrentStepId(status, customerApproval)
  return Math.max(0, WORKFLOW_STEPS.findIndex((s) => s.id === id))
}

/** Display label Q1, Q2… — revision numbers are 1-based (API + new creates). Legacy 0 maps to Q1. */
export function quotationRevisionLabel(revisionNo: number): string {
  return `Q${revisionNo < 1 ? 1 : revisionNo}`
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
              <span className="quotation-360-hero__rev">{quotationRevisionLabel(doc.revisionNo)}</span>
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

export function QuotationWorkflowStepper({
  status,
  customerApproval,
  salesOrderId,
  salesOrderNo,
  onViewSalesOrder,
}: {
  status: QuotationDocumentStatus
  customerApproval?: CustomerApprovalStatus | null
  salesOrderId?: string | null
  salesOrderNo?: string | null
  onViewSalesOrder?: () => void
}) {
  const idx = workflowIndex(status, customerApproval)
  const currentStepId = resolveCurrentStepId(status, customerApproval)
  const isConverted = status === 'converted'
  const isInternalRejected = status === 'rejected'
  const isCustomerRejected = status === 'sent' && customerApproval === 'rejected'
  const policy = resolveQuotationRevisionPolicy({ status, customerApproval })
  const currentLabel = WORKFLOW_STEPS.find((s) => s.id === currentStepId)?.label ?? policy.stageTitle

  return (
    <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Document workflow</p>
          <p className="mt-0.5 text-[14px] font-bold text-erp-text">
            {isInternalRejected
              ? 'Internally rejected — revision available'
              : isCustomerRejected
                ? 'Customer rejected — revision available'
                : isConverted
                  ? 'Converted to Sales Order'
                  : `${currentLabel} · Step ${idx + 1} of ${WORKFLOW_STEPS.length}`}
          </p>
        </div>
        <LiveStatusBadge label={quotationStatusLabel(status)} tone={quotationStatusTone(status)} pulse={false} />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {WORKFLOW_STEPS.map((s, i) => {
          const isCurrent = s.id === currentStepId
          const isPast = i < idx || (isConverted && i <= idx)
          return (
            <div
              key={s.id}
              className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1.5 rounded-md px-0.5 py-1"
            >
              <div className="flex w-full items-center gap-0.5">
                <div
                  className={cn(
                    'h-2 flex-1 rounded-full transition-all',
                    isPast || (isConverted && isCurrent)
                      ? 'bg-erp-primary'
                      : isCurrent
                        ? 'bg-erp-primary ring-2 ring-erp-primary/30 ring-offset-1'
                        : 'bg-erp-surface-alt',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-center text-[10px] font-medium leading-snug text-erp-muted sm:text-[11px]',
                  isCurrent && 'font-bold text-erp-primary',
                  isPast && !isCurrent && 'text-erp-text',
                )}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      <div
        className={cn(
          'mt-3 rounded-lg border px-3 py-2.5',
          isInternalRejected || isCustomerRejected
            ? 'border-erp-danger/30 bg-erp-danger-soft/25'
            : 'border-erp-border/80 bg-erp-surface-alt/40',
        )}
      >
        <p className="text-[12px] font-semibold text-erp-text">{policy.stageTitle}</p>
        <ul className="mt-1.5 space-y-1">
          {policy.guidance.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-[12px] leading-snug text-erp-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-erp-muted" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {(isInternalRejected || isCustomerRejected) ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] text-erp-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Create a new revision to address feedback, then continue the workflow from Draft.
          </p>
        ) : null}
      </div>

      {isConverted && (salesOrderId || salesOrderNo) ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
          <p className="text-[13px] text-emerald-900">
            Linked sales order
            {salesOrderNo ? (
              <>
                {' '}
                <span className="font-mono font-semibold">{salesOrderNo}</span>
              </>
            ) : null}
          </p>
          {salesOrderId && onViewSalesOrder ? (
            <button
              type="button"
              className="text-[12px] font-semibold text-emerald-800 underline-offset-2 hover:underline"
              onClick={onViewSalesOrder}
            >
              Open Sales Order
            </button>
          ) : salesOrderId ? (
            <a
              href={resolveSalesOrderDetailPath(salesOrderId, true)}
              className="text-[12px] font-semibold text-emerald-800 underline-offset-2 hover:underline"
            >
              Open Sales Order
            </a>
          ) : null}
        </div>
      ) : null}
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
