import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Right-side drawer shell for gate quick actions (large touch targets). */
export function GateDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden border-l border-erp-border bg-white shadow-erp-md',
          widthClassName,
        )}
        role="dialog"
        aria-label={title}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-erp-text">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-erp-border bg-erp-surface-alt px-5 py-3">{footer}</div>
        ) : null}
      </aside>
    </>
  )
}
