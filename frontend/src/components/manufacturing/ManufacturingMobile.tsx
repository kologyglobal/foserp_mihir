import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Large touch-friendly shopfloor / WO action button. */
export function MfgTouchBtn({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
  type?: 'button' | 'submit'
}) {
  const tones = {
    primary: 'bg-erp-primary text-white hover:bg-erp-primary/90',
    secondary: 'bg-white text-erp-text ring-1 ring-erp-border hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'bg-transparent text-erp-muted hover:bg-slate-50',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition disabled:opacity-50',
        'active:scale-[0.98] touch-manipulation',
        tones[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Sticky bottom action bar for tablet / phone execution screens. */
export function ManufacturingStickyActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-erp-border bg-white/95 px-3 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        'lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none',
        className,
      )}
      role="toolbar"
      aria-label="Quick actions"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap gap-2 lg:max-w-none">{children}</div>
    </div>
  )
}

/** Spacer so page content is not hidden behind the sticky footer on mobile. */
export function ManufacturingStickyActionSpacer() {
  return <div className="h-20 lg:hidden" aria-hidden />
}
