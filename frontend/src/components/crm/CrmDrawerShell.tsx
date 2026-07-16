import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface CrmDrawerShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg' | 'filter'
  /** Filter drawer — simplified header without CRM eyebrow */
  variant?: 'default' | 'filter'
  /** drawer = right rail; modal = centered enterprise dialog */
  placement?: 'drawer' | 'modal'
}

export function CrmDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  variant = 'default',
  placement = 'drawer',
}: CrmDrawerShellProps) {
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

  const isModal = placement === 'modal'

  return createPortal(
    <div className={cn('crm-drawer-root', isModal && 'crm-drawer-root--modal')} role="presentation">
      <button
        type="button"
        className="crm-drawer-backdrop"
        onClick={onClose}
        aria-label={isModal ? 'Close dialog' : 'Close drawer'}
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
        aria-labelledby="crm-drawer-title"
      >
        <header className="crm-drawer-header">
          <div className="min-w-0 flex-1 pr-3">
            {variant !== 'filter' ? <p className="crm-drawer-eyebrow">CRM</p> : null}
            <h2 id="crm-drawer-title" className="crm-drawer-title">
              {title}
            </h2>
            {subtitle && variant !== 'filter' ? <p className="crm-drawer-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="crm-drawer-close" aria-label="Close">
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
