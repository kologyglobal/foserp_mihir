import { cn } from '@/utils/cn'

export interface GateTab {
  id: string
  label: string
  count?: number
}

/** Horizontal tab strip for gate list pages — large touch targets, scrollable on tablet. */
export function GateTabsStrip({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: GateTab[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <nav
      className={cn('flex gap-0.5 overflow-x-auto border-b border-erp-border bg-white px-1', className)}
      aria-label="List tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-[12.5px] font-semibold transition-colors',
            active === tab.id
              ? 'border-erp-primary text-erp-primary'
              : 'border-transparent text-erp-muted hover:text-erp-text',
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums',
                active === tab.id ? 'bg-erp-primary/10 text-erp-primary' : 'bg-erp-surface-alt text-erp-muted',
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}
