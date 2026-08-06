import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { Button } from '../ui/Button'
import { QuickCreateDrawerForm } from '../quick-create/QuickCreateDrawerForm'

const legacyDrawerLinks: Record<string, { href: string; label: string }> = {
  po: { href: '/purchase/orders', label: 'Go to purchase orders →' },
  wo: { href: '/manufacturing/work-orders', label: 'Go to work orders →' },
}

/**
 * Global quick-create host (vendor, item, etc.).
 * Renders a centered modal dialog — not a right-side drawer.
 */
export function RightDrawer() {
  const drawer = useUIStore((s) => s.drawer)
  const closeDrawer = useUIStore((s) => s.closeDrawer)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!drawer) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([aria-label="Close"]):not([disabled])',
      )?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawer, closeDrawer])

  if (!drawer) return null

  const isLegacy = 'legacyType' in drawer
  const legacyType = isLegacy ? drawer.legacyType : null
  const link = legacyType ? legacyDrawerLinks[legacyType] : null

  return createPortal(
    <div
      className="erp-modal-backdrop erp-quick-create-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDrawer()
      }}
    >
      <div
        ref={panelRef}
        className="erp-modal-panel erp-quick-create-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="erp-quick-create-modal__header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-erp-text">
              {drawer.title}
            </h2>
            <p className="mt-0.5 text-xs text-erp-muted">
              Quick create · unsaved changes will be lost on close
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="shrink-0 rounded-lg p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="erp-quick-create-modal__body">
          {isLegacy ? (
            <>
              <p className="text-[13px] text-erp-muted">
                Quick-create panel — use the full form for complete entry.
              </p>
              {link && (
                <div className="mt-6 space-y-3">
                  <Link to={link.href} onClick={closeDrawer}>
                    <Button>{link.label}</Button>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <QuickCreateDrawerForm />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export { useQuickCreate } from '../../hooks/useQuickCreate'
