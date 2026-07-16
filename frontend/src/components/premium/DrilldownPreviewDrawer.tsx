import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export function DrilldownPreviewDrawer({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/20" aria-label="Close preview" onClick={onClose} />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
          <h2 className="text-sm font-semibold text-erp-text">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-erp-surface-alt">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  )
}
