import { useNavigate } from 'react-router-dom'
import {
  Building2, Calendar, TrendingUp,
  Phone, Mail, ChevronRight, AlertCircle,
} from 'lucide-react'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { entity360CustomerPath } from '../../config/entity360Routes'
import type { Customer } from '../../types/master'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { cn } from '../../utils/cn'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'

interface CustomerCrmSummary {
  openOpportunities: number
  pipelineValue: number
  lastActivityAt: string | null
  nextFollowUpDate: string | null
  hasOverdueFollowUp: boolean
  openQuotations?: number
  openSalesOrders?: number
  outstandingAr?: number
}

interface CustomerCrmCardProps {
  customer: Customer
  summary: CustomerCrmSummary
  onFollowUp?: () => void
}

function customerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function customerHealth(summary: CustomerCrmSummary) {
  if (summary.hasOverdueFollowUp) {
    return { label: 'Overdue follow-up', tone: 'critical' as const }
  }
  if (summary.openOpportunities > 0) {
    return { label: 'Active pipeline', tone: 'healthy' as const }
  }
  if (summary.lastActivityAt) {
    return { label: 'Recently active', tone: 'live' as const }
  }
  return { label: 'No recent activity', tone: 'warning' as const }
}

export function CustomerCrmCard({ customer, summary, onFollowUp }: CustomerCrmCardProps) {
  const navigate = useNavigate()
  const health = customerHealth(summary)
  const open360 = () => navigate(entity360CustomerPath(customer.id))

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open360}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open360() } }}
      className={cn(
        'group flex cursor-pointer flex-col rounded-xl border border-erp-border bg-erp-surface',
        'shadow-[var(--erp-shadow-card)] transition-all duration-200',
        'hover:border-erp-primary/25 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-erp-primary',
        summary.hasOverdueFollowUp && 'border-erp-danger/30',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-erp-primary/15 to-erp-primary/5 text-[13px] font-bold text-erp-primary">
          {customerInitials(customer.customerName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-erp-text group-hover:text-erp-primary">
                {customer.customerName}
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-erp-muted">
                {customer.city} · {customer.customerType}
              </p>
            </div>
            <LiveStatusBadge label={health.label} tone={health.tone} pulse={false} className="shrink-0" />
          </div>
          <p className="mt-1.5 truncate text-[12px] text-erp-muted">{customer.contactPerson}</p>
        </div>
      </div>

      <div className="mx-4 rounded-lg bg-erp-surface-alt/80 px-3 py-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Pipeline</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-erp-text">
              {formatCrmCurrency(summary.pipelineValue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Open opps</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-erp-primary">
              {summary.openOpportunities}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-erp-border/60 bg-erp-border/60 mx-0 mt-3">
        <MiniStat label="Quotations" value={summary.openQuotations ?? 0} />
        <MiniStat label="Open SO" value={summary.openSalesOrders ?? 0} />
        <MiniStat
          label="Outstanding AR"
          value={formatCrmCurrency(summary.outstandingAr ?? 0)}
          highlight={(summary.outstandingAr ?? 0) > 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[11px] text-erp-muted">
        {summary.lastActivityAt ? (
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3 opacity-60" />
            Last {new Date(summary.lastActivityAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        ) : (
          <span className="opacity-70">No activity logged</span>
        )}
        {summary.nextFollowUpDate ? (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              summary.hasOverdueFollowUp && 'font-medium text-erp-danger',
            )}
          >
            {summary.hasOverdueFollowUp ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3 opacity-60" />}
            F/U {summary.nextFollowUpDate}
          </span>
        ) : null}
      </div>

      <div
        className="crm-card-footer"
        onClick={(e) => e.stopPropagation()}
      >
        {customer.contactPhone ? (
          <IconAction href={`tel:${customer.contactPhone}`} label="Call">
            <Phone className="h-3.5 w-3.5" />
          </IconAction>
        ) : null}
        {customer.contactEmail ? (
          <IconAction href={`mailto:${customer.contactEmail}`} label="Email">
            <Mail className="h-3.5 w-3.5" />
          </IconAction>
        ) : null}
        <button
          type="button"
          className="crm-card-action"
          onClick={() => navigate(`/crm/opportunities?customer=${customer.id}`)}
        >
          Pipeline
        </button>
        <button
          type="button"
          className="crm-card-action"
          onClick={onFollowUp}
        >
          Follow-up
        </button>
        <span className="crm-card-footer-cta">
          {COMPANY_TERMINOLOGY.hub360}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  )
}

function MiniStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="bg-erp-surface px-3 py-2 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
      <p className={cn('mt-0.5 truncate text-[12px] font-semibold tabular-nums', highlight && 'text-erp-warning-fg')}>
        {value}
      </p>
    </div>
  )
}

function IconAction({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="crm-card-action crm-card-action--icon"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}

export function CustomerCrmList({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>
}

export function CustomerPortfolioToolbar({
  count,
  total,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  segment,
  onSegmentChange,
}: {
  count: number
  total: number
  viewMode: 'card' | 'list'
  onViewModeChange: (mode: 'card' | 'list') => void
  sortBy: 'pipeline' | 'name' | 'followUp'
  onSortChange: (sort: 'pipeline' | 'name' | 'followUp') => void
  segment: 'all' | 'active' | 'overdue'
  onSegmentChange: (segment: 'all' | 'active' | 'overdue') => void
}) {
  const segments: { id: 'all' | 'active' | 'overdue'; label: string }[] = [
    { id: 'all', label: 'All customers' },
    { id: 'active', label: 'Active pipeline' },
    { id: 'overdue', label: 'Overdue F/U' },
  ]

  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-erp-muted">
          Showing <span className="font-semibold tabular-nums text-erp-text">{count}</span> of {total}
        </p>
        <div className="flex rounded-lg border border-erp-border bg-erp-surface-alt/50 p-0.5">
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSegmentChange(s.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                segment === s.id
                  ? 'bg-erp-surface text-erp-primary shadow-sm'
                  : 'text-erp-text hover:bg-erp-surface-alt',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-erp-muted">
          Sort
          <ErpSmartSelect
            compact
            appearance="dropdown"
            allowEmpty={false}
            value={sortBy}
            onChange={(v) => onSortChange((v || 'pipeline') as 'pipeline' | 'name' | 'followUp')}
            className="min-w-[120px]"
            options={[
              { value: 'pipeline', label: 'Pipeline value', searchText: 'pipeline value' },
              { value: 'name', label: 'Company name', searchText: 'company name' },
              { value: 'followUp', label: 'Follow-up date', searchText: 'follow-up date' },
            ]}
          />
        </label>
        <div className="flex rounded-lg border border-erp-border p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('card')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold',
              viewMode === 'card' ? 'bg-erp-primary text-white' : 'text-erp-text hover:bg-erp-surface-alt',
            )}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold',
              viewMode === 'list' ? 'bg-erp-primary text-white' : 'text-erp-text hover:bg-erp-surface-alt',
            )}
          >
            Table
          </button>
        </div>
      </div>
    </div>
  )
}

export function CustomerCrmEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-erp-border bg-erp-surface-alt/30 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-erp-primary-soft">
        <Building2 className="h-5 w-5 text-erp-primary" />
      </div>
      <p className="text-sm font-semibold text-erp-text">No customers match your filters</p>
      <p className="mt-1 max-w-sm text-[13px] text-erp-muted">
        Try a different segment or clear filters to see the full portfolio.
      </p>
      {onClear ? (
        <button
          type="button"
          className="mt-4 rounded-md bg-erp-primary px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
