import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export type PurchaseLineDetailsDrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
}

/** Centered details popup for purchase document line secondary fields. */
export function PurchaseLineDetailsDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = 'max-w-lg',
}: PurchaseLineDetailsDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close line details"
      />
      <div
        className={cn(
          'relative flex max-h-[min(92vh,880px)] w-full flex-col overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-2xl',
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-line-drawer-title"
      >
        <header className="shrink-0 border-b border-erp-border bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-erp-muted">
                Line details
              </p>
              <h2
                id="purchase-line-drawer-title"
                className="mt-1 break-words text-[16px] font-semibold leading-snug text-erp-text"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 break-words text-[13px] leading-snug text-erp-muted">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-2 text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-erp-bg/40 px-5 py-4">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-erp-border bg-white px-5 py-3">
            <div className="flex items-center justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** Section card used inside purchase line detail drawers. */
export function PurchaseLineDrawerSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
      <div className="mb-3 border-b border-erp-border/70 pb-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">{title}</h3>
        {description ? <p className="mt-0.5 text-[12px] text-erp-muted">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** Compact read-only metric tile for stock / open qty style facts. */
export function PurchaseLineDrawerStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-md border border-erp-border bg-erp-surface-alt/60 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tabular-nums text-erp-text">{value}</div>
    </div>
  )
}
