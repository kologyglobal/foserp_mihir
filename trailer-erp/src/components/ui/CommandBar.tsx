import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'

interface CommandBarProps {
  children: ReactNode
  className?: string
}

/** Compact horizontal action strip */
export function CommandBar({ children, className }: CommandBarProps) {
  return (
    <div className={cn('erp-command-bar', className)}>
      {children}
    </div>
  )
}

export function CommandBarGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex items-center gap-1 border-r border-erp-border px-2 py-0.5 last:border-r-0">
      {label && (
        <span className="erp-command-group-label mr-1 hidden sm:inline">
          {label}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

interface CommandBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  /** Primary action — filled button (e.g. New Lead) */
  primary?: boolean
  /** Secondary emphasis — outlined highlight (e.g. Export) */
  accent?: boolean
}

export function CommandBarButton({ icon: Icon, label, primary, accent, className, ...props }: CommandBarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold',
        'transition-[transform,box-shadow,background,border-color,filter] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary/30 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        'hover:-translate-y-px active:translate-y-px active:scale-[0.98]',
        primary && 'erp-command-btn-primary text-white',
        accent && !primary && 'erp-command-btn-accent',
        !primary && !accent && 'border border-erp-border bg-erp-surface text-erp-text shadow-sm hover:border-erp-primary/35 hover:bg-erp-primary-soft hover:shadow-md',
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          primary ? 'text-white' : accent ? 'text-teal-700' : 'text-erp-primary',
        )}
        strokeWidth={1.75}
      />
      <span>{label}</span>
    </button>
  )
}

export function CommandBarDivider() {
  return <div className="mx-0.5 w-px self-stretch bg-erp-border" />
}

export interface CommandBarOverflowAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
  danger?: boolean
}

/** Single trigger button that opens a dropdown of secondary actions */
export function CommandBarOverflowMenu({
  actions,
  label = 'Actions',
}: {
  actions: CommandBarOverflowAction[]
  label?: string
}) {
  const visible = actions.filter((a) => a.label)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (visible.length === 0) return null

  return (
    <div className="erp-command-more" ref={ref}>
      <CommandBarButton
        icon={ChevronDown}
        label={label}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={open ? 'border-erp-primary/35 bg-erp-primary-soft' : undefined}
      />
      {open ? (
        <div className="erp-command-more__menu" role="menu">
          {visible.map((action) => {
            const Icon = action.icon ?? Circle
            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={cn(
                  'erp-command-more__item',
                  action.danger && 'erp-command-more__item--danger',
                )}
                disabled={action.disabled}
                title={action.disabled ? action.disabledReason : undefined}
                onClick={() => {
                  setOpen(false)
                  action.onClick?.()
                }}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                {action.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
