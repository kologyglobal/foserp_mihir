import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Centered form popup (replaces the old right-side drawer). */
export function LedgerDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = 'max-w-xl',
  eyebrow = 'Accounting',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
  eyebrow?: string
}) {
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
        aria-label="Close dialog"
      />
      <div
        className={cn(
          'relative flex max-h-[min(92vh,880px)] w-full flex-col overflow-hidden rounded-xl border border-erp-border bg-white shadow-2xl',
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-drawer-title"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-erp-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">{eyebrow}</p>
            <h2 id="ledger-drawer-title" className="truncate text-[16px] font-semibold text-erp-text">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-erp-border bg-erp-surface px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function LedgerConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
  children?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close dialog" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-confirm-title"
        className="relative w-full max-w-md rounded-xl border border-erp-border bg-white p-5 shadow-2xl"
      >
        <h3 id="ledger-confirm-title" className="text-[15px] font-semibold text-erp-text">
          {title}
        </h3>
        {description ? <p className="mt-2 text-[13px] text-erp-muted">{description}</p> : null}
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
