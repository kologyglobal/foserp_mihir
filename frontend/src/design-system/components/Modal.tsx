import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** When true, Esc / backdrop / × do not dismiss (e.g. in-flight submit). */
  closeDisabled?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeDisabled = false,
}: ModalProps) {
  useEffect(() => {
    if (!open || closeDisabled) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, closeDisabled])

  if (!open) return null

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
  const handleClose = () => {
    if (!closeDisabled) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[var(--ds-z-modal,500)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ds-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-label="Close dialog"
        disabled={closeDisabled}
      />
      <div className={cn('relative w-full rounded-lg border border-[var(--dyn-border)] bg-[var(--dyn-bg-card)] shadow-lg', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dyn-border)] px-4 py-3">
          <div>
            <h2 id="ds-modal-title" className="ds-type-workspace-title font-semibold text-[var(--dyn-text)]">{title}</h2>
            {description ? <p className="ds-type-caption mt-0.5 text-[var(--dyn-text-muted)]">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={closeDisabled} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer ? <div className="border-t border-[var(--dyn-border)] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
