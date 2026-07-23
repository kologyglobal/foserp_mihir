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
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'kiosk'
  /** When true, Esc / backdrop / × do not dismiss (e.g. in-flight submit). */
  closeDisabled?: boolean
  className?: string
  bodyClassName?: string
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
  className,
  bodyClassName,
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

  const width =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
        ? 'max-w-3xl'
        : size === 'xl'
          ? 'max-w-5xl'
          : size === 'kiosk'
            ? 'max-w-6xl'
            : 'max-w-xl'
  const isKiosk = size === 'kiosk'
  const handleClose = () => {
    if (!closeDisabled) onClose()
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[var(--ds-z-modal,500)] flex items-center justify-center',
        isKiosk ? 'p-2 sm:p-4' : 'p-4',
      )}
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
      <div
        className={cn(
          'relative flex w-full flex-col rounded-lg border border-[var(--dyn-border)] bg-[var(--dyn-bg-card)] shadow-lg',
          width,
          isKiosk && 'max-h-[96vh] rounded-2xl',
          className,
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b border-[var(--dyn-border)]',
            isKiosk ? 'px-5 py-4 sm:px-6' : 'px-4 py-3',
          )}
        >
          <div>
            <h2
              id="ds-modal-title"
              className={cn(
                'font-semibold text-[var(--dyn-text)]',
                isKiosk ? 'text-xl sm:text-2xl' : 'ds-type-workspace-title',
              )}
            >
              {title}
            </h2>
            {description ? (
              <p
                className={cn(
                  'mt-0.5 text-[var(--dyn-text-muted)]',
                  isKiosk ? 'text-sm sm:text-base' : 'ds-type-caption',
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size={isKiosk ? 'md' : 'sm'}
            onClick={handleClose}
            disabled={closeDisabled}
            aria-label="Close"
          >
            <X className={isKiosk ? 'h-6 w-6' : 'h-4 w-4'} />
          </Button>
        </div>
        <div
          className={cn(
            'overflow-y-auto',
            isKiosk ? 'min-h-0 flex-1 p-5 sm:p-6' : 'max-h-[70vh] p-4',
            isKiosk && 'max-h-[calc(96vh-9rem)]',
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              'shrink-0 border-t border-[var(--dyn-border)]',
              isKiosk ? 'px-5 py-4 sm:px-6' : 'px-4 py-3',
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
