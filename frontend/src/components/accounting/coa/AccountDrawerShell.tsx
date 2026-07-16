import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../../utils/cn'

export function AccountDrawerShell({
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
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-label="Close drawer" />
      <aside
        className={cn(
          'relative flex h-full w-full flex-col border-l border-erp-border bg-white shadow-xl',
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coa-drawer-title"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-erp-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">{eyebrow}</p>
            <h2 id="coa-drawer-title" className="truncate text-[15px] font-semibold text-erp-text">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-erp-border bg-erp-surface px-4 py-3">{footer}</div>
        ) : null}
      </aside>
    </div>,
    document.body,
  )
}

export function AccountConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="coa-confirm-title"
        className="relative w-full max-w-md rounded-lg border border-erp-border bg-white p-5 shadow-xl"
      >
        <h3 id="coa-confirm-title" className="text-[15px] font-semibold text-erp-text">
          {title}
        </h3>
        {description ? <p className="mt-2 text-[13px] text-erp-muted">{description}</p> : null}
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(
              'erp-btn h-9 px-3 text-[13px] font-semibold',
              destructive ? 'bg-red-600 text-white hover:bg-red-700' : 'erp-btn-primary',
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
