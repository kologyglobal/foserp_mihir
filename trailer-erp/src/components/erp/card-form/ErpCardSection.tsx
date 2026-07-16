import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface ErpCardSectionProps {
  id?: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  badge?: ReactNode
  step?: number
  optional?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  dense?: boolean
  /** Field grid columns. Dense defaults to 3 (tablet 2 / mobile 1 via CSS). */
  columns?: 1 | 2 | 3
  accent?: 'blue' | 'teal' | 'green' | 'amber' | 'violet' | 'slate'
}

/** BC FastTab panel — dense section card for card forms */
export function ErpCardSection({
  id,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  badge,
  step,
  optional,
  collapsible = false,
  defaultOpen = true,
  dense = true,
  columns,
  accent = 'blue',
}: ErpCardSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  /** Standard business forms default to 3-col dense grid (tablet 2 / mobile 1 via CSS). */
  const gridColumns = columns ?? (dense ? 3 : 1)

  return (
    <section
      id={id}
      className={cn(
        'erp-card-section',
        accent && `erp-card-section--accent-${accent}`,
        !open && 'erp-card-section--collapsed',
        className,
      )}
    >
      <header className="erp-card-section__header">
        <button
          type="button"
          className={cn(
            'erp-card-section__header-btn',
            !collapsible && 'erp-card-section__header-btn--static',
          )}
          onClick={() => collapsible && setOpen((v) => !v)}
          aria-expanded={open}
        >
          {step != null ? (
            <span className="erp-card-section__step" aria-hidden>{step}</span>
          ) : Icon ? (
            <span className="erp-card-section__icon" aria-hidden><Icon className="h-4 w-4" /></span>
          ) : null}
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="erp-card-section__title">{title}</h2>
              {optional ? <span className="erp-card-section__optional">Optional</span> : null}
            </div>
            {subtitle ? <p className="erp-card-section__subtitle">{subtitle}</p> : null}
          </div>
          {badge || collapsible ? (
            <span className="erp-card-section__meta">
              {badge ? <span className="erp-card-section__badge shrink-0">{badge}</span> : null}
              {collapsible ? (
                <ChevronDown className={cn('erp-card-section__chevron', open && 'erp-card-section__chevron--open')} />
              ) : null}
            </span>
          ) : null}
        </button>
      </header>
      {open ? (
        <div className="erp-card-section__body">
          <div
            className={cn(
              'erp-card-section__grid',
              dense && 'erp-card-section__grid--dense',
              gridColumns === 1 && 'erp-card-section__grid--cols-1',
              gridColumns === 2 && 'erp-card-section__grid--cols-2',
              gridColumns === 3 && 'erp-card-section__grid--cols-3',
            )}
          >
            {children}
          </div>
        </div>
      ) : null}
    </section>
  )
}
