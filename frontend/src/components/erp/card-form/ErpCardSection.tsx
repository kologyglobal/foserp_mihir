import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface ErpCardSectionProps {
  id?: string
  title: string
  subtitle?: string
  /**
   * Short header meta shown when the FastTab is collapsed (BC-style peek).
   * When open, `subtitle` is shown instead.
   */
  collapsedSummary?: ReactNode
  icon?: LucideIcon
  children: ReactNode
  className?: string
  badge?: ReactNode
  step?: number
  optional?: boolean
  collapsible?: boolean
  /** Uncontrolled initial open state. Ignored when `open` is provided. */
  defaultOpen?: boolean
  /** Controlled open state. Pair with `onOpenChange`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * When this value changes (and is defined), force the FastTab open.
   * Used by form validation to reveal the section containing the first error
   * without permanently taking over collapse state.
   */
  forceOpenKey?: number
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
  collapsedSummary,
  icon: Icon,
  children,
  className,
  badge,
  step,
  optional,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  forceOpenKey,
  dense = true,
  columns,
  accent = 'blue',
}: ErpCardSectionProps) {
  const isControlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = isControlled ? openProp : uncontrolledOpen
  const lastForceOpenKey = useRef<number | undefined>(undefined)

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (forceOpenKey === undefined) return
    if (forceOpenKey === lastForceOpenKey.current) return
    lastForceOpenKey.current = forceOpenKey
    setOpen(true)
    // setOpen is stable enough for this expand-on-validate path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpenKey])

  /** Standard business forms default to 3-col dense grid (tablet 2 / mobile 1 via CSS). */
  const gridColumns = columns ?? (dense ? 3 : 1)
  const headerSecondary =
    open
      ? subtitle
      : collapsedSummary != null && collapsedSummary !== ''
        ? collapsedSummary
        : subtitle

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
          onClick={() => collapsible && setOpen(!open)}
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
            {headerSecondary ? (
              <p
                className={cn(
                  'erp-card-section__subtitle',
                  !open && collapsedSummary != null && collapsedSummary !== '' && 'erp-card-section__summary',
                )}
              >
                {headerSecondary}
              </p>
            ) : null}
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
