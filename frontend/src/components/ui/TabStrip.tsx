import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
  /** Native tooltip (e.g. content preview). */
  title?: string
  /** Small filled dot — typically means the tab has content. */
  indicator?: boolean
}

interface TabStripProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

/** Business Central–style underline tab strip */
export function TabStrip<T extends string>({ tabs, active, onChange, className }: TabStripProps<T>) {
  return (
    <div className={cn('border-b border-erp-border bg-erp-surface', className)}>
      <div className="flex gap-0 overflow-x-auto px-1">
        {tabs.map(({ id, label, icon: Icon, count, title, indicator }) => (
          <button
            key={id}
            type="button"
            title={title}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
              active === id
                ? 'border-erp-primary text-erp-primary'
                : 'border-transparent text-erp-muted hover:border-gray-300 hover:text-erp-text',
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
            <span className="inline-flex items-center gap-1.5">
              {label}
              {indicator ? (
                <span
                  aria-hidden
                  className={cn(
                    'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                    active === id ? 'bg-erp-primary' : 'bg-erp-muted',
                  )}
                />
              ) : null}
            </span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  active === id ? 'bg-erp-primary-soft text-erp-primary' : 'bg-gray-100 text-erp-muted',
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
