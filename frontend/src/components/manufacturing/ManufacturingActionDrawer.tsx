import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Shared action drawer — bottom sheet on phone/tablet, right panel on desktop. */
export function ManufacturingActionDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = 'max-w-lg',
  closeDisabled,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
  closeDisabled?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [closeDisabled, onClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-stretch md:justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => {
          if (!closeDisabled) onClose()
        }}
        aria-label="Close drawer backdrop"
      />
      <aside
        className={cn(
          'relative flex w-full flex-col border-erp-border bg-white shadow-xl',
          'max-h-[92vh] rounded-t-2xl border-t',
          'md:h-full md:max-h-none md:rounded-none md:border-l md:border-t-0',
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfg-action-drawer-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 md:hidden" aria-hidden />
        <header className="flex shrink-0 items-start gap-3 border-b border-erp-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Work Order</p>
            <h2 id="mfg-action-drawer-title" className="truncate text-[16px] font-semibold text-erp-text md:text-[15px]">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-erp-muted md:text-[12px]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-lg p-2 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[15px] md:py-3 md:text-[13px]">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-erp-border bg-erp-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  )
}
