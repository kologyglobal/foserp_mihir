import type { Lead, LeadStage } from '../../types/sales'
import { formatCurrency } from '../../utils/formatters/currency'
import { leadStageLabel, migrateLeadStage, normalizeLead } from '../../utils/leadUtils'
import { LeadStageChip } from './LeadStageChip'
import { Building2, Target, User } from 'lucide-react'
import { cn } from '../../utils/cn'

const FUNNEL_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'requirement_collected',
  'qualified',
  'not_qualified',
  'converted_to_opportunity',
  'closed',
]

export function LeadStageStepper({ stage }: { stage: LeadStage }) {
  const current = migrateLeadStage(stage)
  const happyPath: LeadStage[] = [
    'new',
    'contacted',
    'requirement_collected',
    'qualified',
    'converted_to_opportunity',
  ]
  const isTerminal = current === 'not_qualified' || current === 'closed'
  const happyIdx = happyPath.indexOf(current)

  return (
    <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Lead stage</p>
      <div className="mt-3 flex gap-1">
        {FUNNEL_STAGES.map((s) => {
          const isCurrent = s === current
          const isPast = !isTerminal && happyPath.includes(s) && happyIdx > happyPath.indexOf(s)
          const isLost = isTerminal && isCurrent
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-2 w-full rounded-full',
                  isLost ? 'bg-erp-danger ring-2 ring-erp-danger/25'
                    : isPast ? 'bg-erp-primary'
                      : isCurrent ? 'bg-erp-primary ring-2 ring-erp-primary/25'
                        : 'bg-erp-surface-alt',
                )}
              />
              <span
                className={cn(
                  'text-[8px] font-medium text-center text-erp-muted leading-tight',
                  isCurrent && !isLost && 'font-bold text-erp-primary',
                  isLost && 'font-bold text-erp-danger',
                  isPast && 'text-erp-text',
                )}
              >
                {leadStageLabel(s)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LeadHeroCard({
  lead,
  customerLabel,
  activityCount,
  openFollowUps,
}: {
  lead: Lead
  customerLabel: string
  activityCount: number
  openFollowUps: number
}) {
  const n = normalizeLead(lead)
  return (
    <div className="lead-hero-card">
      <div className="lead-hero-card-glow" aria-hidden />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <LeadStageChip stage={n.stage} />
            <span className="rounded-md border border-erp-border bg-erp-surface-alt px-2 py-0.5 text-[10px] font-bold uppercase text-erp-muted">
              {n.activityStatus === 'active' ? 'Active' : 'Inactive'}
            </span>
            <span className="rounded-md border border-erp-border bg-erp-surface-alt px-2 py-0.5 text-[10px] font-bold uppercase text-erp-muted">
              {n.lifecycleStatus}
            </span>
          </div>
          <div>
            <p className="font-mono text-[11px] font-semibold text-erp-primary">{lead.leadNo}</p>
            <h1 className="text-xl font-semibold tracking-tight text-erp-text">{lead.prospectName}</h1>
            <p className="mt-0.5 text-[13px] text-erp-muted">{lead.industry || 'Industry from company master'}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-[12px] text-erp-muted">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {n.leadOwnerName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {customerLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {lead.probability}% probability
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="lead-hero-stat">
            <span className="lead-hero-stat-label">Expected value</span>
            <span className="lead-hero-stat-value">{formatCurrency(lead.expectedValue)}</span>
          </div>
          <div className="lead-hero-stat">
            <span className="lead-hero-stat-label">Activities</span>
            <span className="lead-hero-stat-value">{activityCount}</span>
          </div>
          <div className="lead-hero-stat">
            <span className="lead-hero-stat-label">Open FU</span>
            <span className={cn('lead-hero-stat-value', openFollowUps > 0 && 'text-erp-warning-fg')}>{openFollowUps}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
