import { cn } from '../../utils/cn'

export function ModuleNavigationBadge({
  count,
  tone = 'default',
  capAt,
  className,
}: {
  count: number
  tone?: 'default' | 'alert' | 'live'
  /** When set, displays e.g. "9+" for counts above this value */
  capAt?: number
  className?: string
}) {
  if (count <= 0) return null
  const label =
    capAt != null && count > capAt ? `${capAt}+` : count > 99 ? '99+' : count
  return (
    <span
      className={cn(
        'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-erp-2xs font-semibold tabular-nums leading-none',
        tone === 'alert' && 'bg-erp-danger-soft text-erp-danger ring-1 ring-erp-danger/15',
        tone === 'live' && 'bg-erp-accent-soft text-erp-primary ring-1 ring-erp-accent/25',
        tone === 'default' && 'bg-erp-primary-soft text-erp-primary ring-1 ring-erp-primary/12',
        className,
      )}
    >
      {label}
    </span>
  )
}
