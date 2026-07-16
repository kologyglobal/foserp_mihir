import { Building2, Calendar, User, TrendingUp } from 'lucide-react'
import type { Opportunity, OpportunityStage } from '../../types/crm'
import type { Customer } from '../../types/master'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { openOpportunityStages, opportunityPriorityLabel, opportunityStageLabel } from '../../utils/opportunityUtils'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { cn } from '../../utils/cn'

const OPEN_STAGES = openOpportunityStages()

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-erp-danger-soft text-erp-danger-fg border-erp-danger/20',
  high: 'bg-erp-warning-soft text-erp-warning-fg border-erp-warning/20',
  strategic: 'bg-purple-50 text-purple-800 border-purple-200',
  medium: 'bg-erp-primary-soft text-erp-primary border-erp-primary/20',
  normal: 'bg-erp-primary-soft text-erp-primary border-erp-primary/20',
  low: 'bg-erp-surface-alt text-erp-muted border-erp-border',
}

function stageTone(stage: OpportunityStage): 'healthy' | 'critical' | 'warning' | 'live' {
  if (stage === 'won') return 'healthy'
  if (stage === 'lost') return 'critical'
  if (stage === 'on_hold') return 'warning'
  return 'live'
}

export function HealthScoreRing({
  score,
  size = 64,
  variant = 'default',
}: {
  score: number
  size?: number
  variant?: 'default' | 'light'
}) {
  const stroke = score >= 70 ? 'var(--erp-success)' : score >= 40 ? 'var(--erp-warning)' : 'var(--erp-danger)'
  const track = variant === 'light' ? 'rgb(255 255 255 / 0.25)' : 'var(--erp-border)'
  const labelClass = variant === 'light' ? 'text-white/70' : 'text-erp-muted'
  const valueClass = variant === 'light' ? 'text-white' : 'text-erp-text'
  const r = 15.5
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke={track} strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-[15px] font-bold tabular-nums leading-none', valueClass)}>{score}</span>
        <span className={cn('text-[8px] font-semibold uppercase', labelClass)}>Health</span>
      </div>
    </div>
  )
}

export function DealHeroCard({
  opportunity,
  customer,
  weighted,
  onOpenCustomer,
}: {
  opportunity: Opportunity
  customer?: Customer
  weighted: number
  onOpenCustomer?: () => void
}) {
  const overdueFu = opportunity.nextFollowUpDate
    && opportunity.nextFollowUpDate.slice(0, 10) < new Date().toISOString().slice(0, 10)

  return (
    <div className="relative overflow-hidden rounded-xl border border-erp-primary/15 bg-gradient-to-br from-erp-primary/[0.07] via-erp-surface to-erp-surface-alt/30 p-5 shadow-[var(--erp-shadow-card)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-erp-primary/[0.06]" />
      <div className="pointer-events-none absolute -bottom-6 left-1/3 h-24 w-24 rounded-full bg-erp-success/[0.04]" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <LiveStatusBadge label={opportunityStageLabel(opportunity.stage)} tone={stageTone(opportunity.stage)} size="md" pulse={false} />
            <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase', PRIORITY_STYLES[opportunity.priority])}>
              {opportunityPriorityLabel(opportunity.priority)}
            </span>
            {overdueFu ? <LiveStatusBadge label="Overdue follow-up" tone="critical" pulse={false} /> : null}
          </div>

          {customer ? (
            <button
              type="button"
              onClick={onOpenCustomer}
              className="group flex items-center gap-2 text-left text-[13px] text-erp-muted transition-colors hover:text-erp-primary"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="font-semibold text-erp-text group-hover:text-erp-primary">{customer.customerName}</span>
              <span>· {customer.city}</span>
            </button>
          ) : null}

          <div className="flex flex-wrap gap-4 text-[12px] text-erp-muted">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {opportunity.ownerName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Close {new Date(opportunity.expectedCloseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {opportunity.nextFollowUpDate ? (
              <span className={cn('inline-flex items-center gap-1.5', overdueFu && 'font-semibold text-erp-danger')}>
                F/U {opportunity.nextFollowUpDate}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Deal value</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-erp-text">{formatCrmCurrency(opportunity.value)}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-erp-muted">
              <TrendingUp className="h-3 w-3" />
              Weighted {formatCrmCurrency(weighted)} · {opportunity.probability}%
            </p>
          </div>
          <HealthScoreRing score={opportunity.healthScore} />
        </div>
      </div>
    </div>
  )
}

export function DealStageStepper({
  stage,
  onStageClick,
}: {
  stage: OpportunityStage
  onStageClick?: (stage: OpportunityStage) => void
}) {
  const idx = OPEN_STAGES.findIndex((s) => s.id === stage)
  const isClosed = stage === 'won' || stage === 'lost' || stage === 'on_hold'

  return (
    <div className="opp-360-stepper">
      <div className="opp-360-stepper__head">
        <div>
          <p className="opp-360-stepper__label">Pipeline position</p>
          <p className="opp-360-stepper__title">
            {isClosed ? opportunityStageLabel(stage) : `Step ${idx + 1} of ${OPEN_STAGES.length}`}
          </p>
        </div>
        {onStageClick ? (
          <button type="button" className="opp-360-stepper__change" onClick={() => onStageClick(stage)}>
            Change stage
          </button>
        ) : null}
      </div>

      {isClosed ? (
        <div className="opp-360-stepper__closed">
          Deal marked as <strong>{opportunityStageLabel(stage)}</strong>
        </div>
      ) : (
        <div className="opp-360-stepper__track">
          {OPEN_STAGES.map((s, i) => {
            const isCurrent = s.id === stage
            const isPast = i < idx
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStageClick?.(s.id)}
                className={cn(
                  'opp-360-stepper__step',
                  isCurrent && 'opp-360-stepper__step--current',
                  isPast && 'opp-360-stepper__step--past',
                )}
              >
                <div className="opp-360-stepper__bar" />
                <span className="opp-360-stepper__step-label">{s.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
