import { cn } from '../../utils/cn'

export type LiveTone = 'live' | 'healthy' | 'warning' | 'critical'

const toneStyles: Record<LiveTone, string> = {
  live: 'border-cyan-200/80 bg-erp-accent-soft text-erp-accent',
  healthy: 'border-emerald-200/80 bg-erp-success-soft text-erp-success-fg',
  warning: 'border-amber-200/80 bg-erp-warning-soft text-erp-warning-fg',
  critical: 'border-red-200/80 bg-erp-danger-soft text-erp-danger-fg',
}

const dotStyles: Record<LiveTone, string> = {
  live: 'bg-erp-accent',
  healthy: 'bg-erp-success',
  warning: 'bg-erp-warning',
  critical: 'bg-erp-danger',
}

export function LiveStatusBadge({
  label,
  tone = 'live',
  pulse = false,
  size = 'sm',
  className,
}: {
  label: string
  tone?: LiveTone
  pulse?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={cn(
        'erp-status-badge inline-flex max-w-full items-center gap-1.5 border font-semibold',
        size === 'sm' ? 'rounded-md px-2 py-0.5 text-[10px]' : 'rounded-lg px-2.5 py-1 text-[11px]',
        toneStyles[tone],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {pulse && tone === 'live' ? (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dotStyles[tone])} />
        ) : null}
        <span className={cn('relative h-1.5 w-1.5 rounded-full', dotStyles[tone])} />
      </span>
      <span className="truncate capitalize">{label}</span>
    </span>
  )
}
