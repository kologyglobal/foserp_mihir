import { cn } from '../../utils/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  helper?: string
  trend?: string
  accent?: 'blue' | 'red' | 'amber' | 'green' | 'purple' | 'slate' | 'cyan' | 'indigo'
  valueClassName?: string
  onClick?: () => void
}

const accentBorder: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'border-l-erp-primary',
  red: 'border-l-erp-danger',
  amber: 'border-l-erp-warning',
  green: 'border-l-erp-success',
  purple: 'border-l-purple-500',
  slate: 'border-l-slate-400',
  cyan: 'border-l-erp-cyan',
  indigo: 'border-l-erp-indigo',
}

const accentIcon: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'bg-erp-info-soft text-erp-info-fg',
  red: 'bg-erp-danger-soft text-erp-danger-fg',
  amber: 'bg-erp-warning-soft text-erp-warning-fg',
  green: 'bg-erp-success-soft text-erp-success-fg',
  purple: 'bg-purple-50 text-purple-600',
  slate: 'bg-slate-100 text-erp-muted',
  cyan: 'bg-cyan-50 text-erp-cyan',
  indigo: 'bg-indigo-50 text-erp-indigo',
}

export function StatCard({
  title,
  value,
  icon: Icon,
  helper,
  trend,
  accent = 'blue',
  valueClassName,
  onClick,
}: StatCardProps) {
  const helperText = helper ?? trend
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'erp-kpi-card erp-bc-cue flex border-l-[3px] text-left',
        accentBorder[accent],
        onClick && 'cursor-pointer',
      )}
    >
      <div className="relative z-[1] flex w-full items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-erp-muted">{title}</p>
          <p className={cn('erp-kpi-value mt-1 truncate', valueClassName)}>{value}</p>
          {helperText && (
            <p className="mt-1 text-[12px] text-erp-muted">{helperText}</p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accentIcon[accent])}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </Tag>
  )
}
