import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface CrmDrawerShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Module eyebrow above the title (e.g. CRM, Purchase). Omit to hide. */
  eyebrow?: string | null
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg' | 'filter'
  /** Filter drawer — simplified header without CRM eyebrow */
  variant?: 'default' | 'filter'
  /** drawer = right rail; modal = centered enterprise dialog */
  placement?: 'drawer' | 'modal'
  /** When true, Esc / backdrop / × do not dismiss (e.g. in-flight submit). */
  closeDisabled?: boolean
}

/**
 * Initial focus + Escape are handled here.
 * Backdrop click closes when not closeDisabled.
 */
export function CrmDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  eyebrow = 'CRM',
  children,
  footer,
  width = 'md',
  variant = 'default',
  placement = 'drawer',
  closeDisabled = false,
}: CrmDrawerShellProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const panel = document.getElementById(titleId)?.closest('[role="dialog"]')
      panel?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([aria-label="Close"]):not([disabled])',
      )?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, closeDisabled, titleId])

  if (!open) return null

  const isModal = placement === 'modal'
  const handleClose = () => {
    if (!closeDisabled) onClose()
  }

  return createPortal(
    <div className={cn('crm-drawer-root', isModal && 'crm-drawer-root--modal')} role="presentation">
      <button
        type="button"
        className="crm-drawer-backdrop"
        onClick={handleClose}
        aria-label={isModal ? 'Close dialog' : 'Close drawer'}
        disabled={closeDisabled}
      />
      <aside
        className={cn(
          'crm-drawer-panel',
          isModal && 'crm-drawer-panel--modal',
          !isModal && width === 'lg' && 'crm-drawer-panel-lg',
          !isModal && width === 'filter' && 'crm-drawer-panel-filter',
          variant === 'filter' && 'crm-drawer-panel--filter-variant',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="crm-drawer-header">
          <div className="min-w-0 flex-1 pr-3">
            {variant !== 'filter' && eyebrow ? <p className="crm-drawer-eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="crm-drawer-title">
              {title}
            </h2>
            {subtitle && variant !== 'filter' ? <p className="crm-drawer-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="crm-drawer-close"
            aria-label="Close"
            disabled={closeDisabled}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="crm-drawer-body">{children}</div>
        {footer ? <footer className="crm-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  )
}
