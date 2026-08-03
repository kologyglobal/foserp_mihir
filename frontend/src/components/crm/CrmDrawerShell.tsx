import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, type LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export type CrmPopupAccent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type CrmPopupSize = 'sm' | 'md' | 'lg' | 'xl'

export interface CrmDrawerShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Module eyebrow above the title (e.g. CRM). Omit or null to hide. */
  eyebrow?: string | null
  /** Optional header icon inside the accent tile */
  icon?: LucideIcon
  /** Left-edge / icon accent */
  accent?: CrmPopupAccent
  children: ReactNode
  footer?: ReactNode
  /** Drawer rail width (side placement only) */
  width?: 'md' | 'lg' | 'filter'
  /** Modal panel width */
  size?: CrmPopupSize
  /** Filter drawer — simplified header without CRM eyebrow */
  variant?: 'default' | 'filter'
  /** drawer = right rail; modal = centered CRM dialog (preferred for create/edit) */
  placement?: 'drawer' | 'modal'
  /** When true, Esc / backdrop / × do not dismiss (e.g. in-flight submit). */
  closeDisabled?: boolean
}

/**
 * Shared CRM popup surface — modal dialog or side drawer.
 * Use placement="modal" for create/edit/quick actions so CRM feels consistent.
 */
export function CrmDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  eyebrow = 'CRM',
  icon: Icon,
  accent = 'primary',
  children,
  footer,
  width = 'md',
  size = 'md',
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
    <div
      className={cn('crm-popup-root', isModal ? 'crm-popup-root--modal' : 'crm-popup-root--drawer')}
      role="presentation"
    >
      <button
        type="button"
        className="crm-popup-backdrop"
        onClick={handleClose}
        aria-label={isModal ? 'Close dialog' : 'Close drawer'}
        disabled={closeDisabled}
      />
      <aside
        className={cn(
          'crm-popup-panel',
          isModal ? 'crm-popup-panel--modal' : 'crm-popup-panel--drawer',
          isModal && `crm-popup-panel--size-${size}`,
          !isModal && width === 'lg' && 'crm-popup-panel--rail-lg',
          !isModal && width === 'filter' && 'crm-popup-panel--rail-filter',
          variant === 'filter' && 'crm-popup-panel--filter',
          `crm-popup-panel--accent-${accent}`,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="crm-popup-accent" aria-hidden />
        <header className="crm-popup-header">
          <div className="crm-popup-header__main">
            {variant !== 'filter' && Icon ? (
              <span className="crm-popup-icon" aria-hidden>
                <Icon className="crm-popup-icon__glyph" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="crm-popup-header__text min-w-0">
              {variant !== 'filter' && eyebrow ? <p className="crm-popup-eyebrow">{eyebrow}</p> : null}
              <h2 id={titleId} className="crm-popup-title">
                {title}
              </h2>
              {subtitle && variant !== 'filter' ? <p className="crm-popup-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="crm-popup-close"
            aria-label="Close"
            disabled={closeDisabled}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="crm-popup-body">{children}</div>
        {footer ? <footer className="crm-popup-footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  )
}

/** CRM centered dialog — preferred for Log Activity, follow-ups, confirms, quick create. */
export function CrmModal(props: Omit<CrmDrawerShellProps, 'placement'> & { placement?: 'modal' }) {
  return <CrmDrawerShell {...props} placement="modal" />
}
