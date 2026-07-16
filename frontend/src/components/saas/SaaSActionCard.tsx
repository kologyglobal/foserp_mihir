import { ArrowRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { NextActionSeverity } from '../../services/nextActionEngine'

export function SaaSActionCard({
  title,
  reason,
  valueImpact,
  severity,
  actionLabel,
  onClick,
}: {
  title: string
  reason: string
  valueImpact?: string
  severity: NextActionSeverity
  actionLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'saas-action-card group w-full',
        severity === 'critical' && 'saas-action-critical',
        severity === 'high' && 'saas-action-high',
        severity === 'medium' && 'saas-action-medium',
        severity === 'low' && 'saas-action-low',
      )}
    >
      <p className="text-sm font-semibold text-[var(--saas-text)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--saas-muted)]">{reason}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        {valueImpact && (
          <span className="text-[0.6875rem] font-semibold tabular-nums text-[var(--saas-primary)]">{valueImpact}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--saas-primary)] opacity-0 transition-opacity group-hover:opacity-100">
          {actionLabel} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  )
}
