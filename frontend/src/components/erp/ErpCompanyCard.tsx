import { useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  Target,
  FileText,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import type { Customer } from '../../types/master'
import type { CrmCompanyStatus } from '../../utils/crmCompanyStatus'
import { resolveCompany360Path } from '../../config/entity360Routes'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpButton } from './ErpButton'
import { cn } from '../../utils/cn'

export interface ErpCompanyCardSummary {
  openOpportunities: number
  pipelineValue: number
  lastActivityAt: string | null
  nextFollowUpDate: string | null
  hasOverdueFollowUp: boolean
  openQuotations?: number
  openSalesOrders?: number
  outstandingAr?: number
}

export interface ErpCompanyCardProps {
  customer: Customer
  summary: ErpCompanyCardSummary
  status: CrmCompanyStatus
  primaryContact?: string
  ownerName?: string
  onOpen360?: () => void
  onOpportunity?: () => void
  onFollowUp?: () => void
  onQuotation?: () => void
}

function customerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function ErpCompanyCard({
  customer,
  summary,
  status,
  primaryContact,
  ownerName = 'Unassigned',
  onOpen360,
  onOpportunity,
  onFollowUp,
  onQuotation,
}: ErpCompanyCardProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const open360 = onOpen360 ?? (() => navigate(resolveCompany360Path(customer.id, pathname)))
  const showFollowUp = summary.hasOverdueFollowUp || Boolean(summary.nextFollowUpDate)

  return (
    <article className={cn('erp-company-card', summary.hasOverdueFollowUp && 'erp-company-card--overdue')}>
      <div className="erp-company-card__header">
        <div className="erp-company-card__avatar" aria-hidden>
          {customerInitials(customer.customerName)}
        </div>
        <div className="erp-company-card__title-block">
          <div className="erp-company-card__title-row">
            <h3 className="erp-company-card__title">{customer.customerName}</h3>
            <DynamicsStatusChip label={status.label} tone={status.tone} />
          </div>
          <p className="erp-company-card__type">{customer.customerType}</p>
        </div>
      </div>

      <div className="erp-company-card__meta">
        <span>{customer.city}</span>
        <span className="erp-company-card__dot" aria-hidden>·</span>
        <span>{customer.industry ?? 'Transport & Logistics'}</span>
        <span className="erp-company-card__dot" aria-hidden>·</span>
        <span>{primaryContact ?? customer.contactPerson}</span>
        <span className="erp-company-card__dot" aria-hidden>·</span>
        <span>{ownerName}</span>
      </div>

      <div className="erp-company-card__commercial">
        <CommercialKpi label="Pipeline value" value={formatCrmCurrency(summary.pipelineValue)} />
        <CommercialKpi label="Open opps" value={summary.openOpportunities} accent />
        <CommercialKpi label="Quotations" value={summary.openQuotations ?? 0} />
        <CommercialKpi label="Open SO" value={summary.openSalesOrders ?? 0} />
        <CommercialKpi
          label="Outstanding AR"
          value={formatCrmCurrency(summary.outstandingAr ?? 0)}
          warn={(summary.outstandingAr ?? 0) > 0}
        />
      </div>

      <div className="erp-company-card__activity">
        <span>Last activity: {formatShortDate(summary.lastActivityAt)}</span>
        <span
          className={cn(
            'erp-company-card__followup',
            summary.hasOverdueFollowUp && 'erp-company-card__followup--overdue',
          )}
        >
          {summary.hasOverdueFollowUp ? <AlertCircle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
          Next F/U: {formatShortDate(summary.nextFollowUpDate)}
          {summary.hasOverdueFollowUp ? ' · Overdue' : ''}
        </span>
      </div>

      <div className="erp-company-card__footer">
        <div className="erp-company-card__footer-primary">
          <ErpButton size="sm" variant="primary" icon={ExternalLink} onClick={open360}>
            Open 360
          </ErpButton>
          <ErpButton size="sm" variant="secondary" icon={Target} onClick={onOpportunity}>
            Opportunity
          </ErpButton>
          {showFollowUp ? (
            <ErpButton
              size="sm"
              variant={summary.hasOverdueFollowUp ? 'warning' : 'secondary'}
              icon={Calendar}
              onClick={onFollowUp}
            >
              Follow-up
            </ErpButton>
          ) : null}
          <ErpButton size="sm" variant="secondary" icon={FileText} onClick={onQuotation}>
            Quotation
          </ErpButton>
        </div>
        <div className="erp-company-card__footer-icons">
          {customer.contactPhone ? (
            <a href={`tel:${customer.contactPhone}`} className="erp-company-card__icon-link" aria-label="Call">
              <Phone className="h-4 w-4" />
            </a>
          ) : null}
          {customer.contactEmail ? (
            <a href={`mailto:${customer.contactEmail}`} className="erp-company-card__icon-link" aria-label="Email">
              <Mail className="h-4 w-4" />
            </a>
          ) : null}
          {customer.contactPhone ? (
            <a
              href={`https://wa.me/${customer.contactPhone.replace(/\D/g, '')}`}
              className="erp-company-card__icon-link"
              aria-label="WhatsApp"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function CommercialKpi({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string
  value: string | number
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="erp-company-card__kpi">
      <p className="erp-company-card__kpi-label">{label}</p>
      <p
        className={cn(
          'erp-company-card__kpi-value',
          accent && 'erp-company-card__kpi-value--accent',
          warn && 'erp-company-card__kpi-value--warn',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function ErpCompanyCardGrid({ children }: { children: React.ReactNode }) {
  return <div className="crm-companies-grid">{children}</div>
}

export function ErpCompanyCardEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="erp-company-card-empty">
      <div className="erp-company-card-empty__icon">
        <Building2 className="h-5 w-5 text-erp-primary" />
      </div>
      <p className="erp-company-card-empty__title">No companies match your filters</p>
      <p className="erp-company-card-empty__hint">Try a different segment or clear filters to see the full portfolio.</p>
      {onClear ? (
        <ErpButton size="sm" variant="primary" onClick={onClear}>
          Clear filters
        </ErpButton>
      ) : null}
    </div>
  )
}
