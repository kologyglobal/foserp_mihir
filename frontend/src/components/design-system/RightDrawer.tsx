import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { Button } from '../ui/Button'
import { QuickCreateDrawerForm } from '../quick-create/QuickCreateDrawerForm'

const legacyDrawerLinks: Record<string, { href: string; label: string }> = {
  po: { href: '/purchase/orders', label: 'Go to purchase orders →' },
  wo: { href: '/work-orders', label: 'Go to work orders →' },
}

export function RightDrawer() {
  const drawer = useUIStore((s) => s.drawer)
  const closeDrawer = useUIStore((s) => s.closeDrawer)

  if (!drawer) return null

  const isLegacy = 'legacyType' in drawer
  const legacyType = isLegacy ? drawer.legacyType : null
  const link = legacyType ? legacyDrawerLinks[legacyType] : null

  return (
    <>
      <div className="erp-right-drawer saas-right-drawer fixed inset-0 z-40 bg-black/30" onClick={closeDrawer} />
      <aside className="erp-right-drawer saas-right-drawer fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-erp-border bg-erp-surface shadow-erp-md">
        <div className="saas-drawer-header flex shrink-0 items-center justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--saas-text)]">{drawer.title}</h2>
            <p className="mt-0.5 text-xs text-[var(--saas-muted)]">Quick create · unsaved changes will be lost on close</p>
          </div>
          <button type="button" onClick={closeDrawer} className="rounded-lg p-1.5 hover:bg-[var(--saas-bg-subtle)]" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-4">
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
      </aside>
    </>
  )
}

export { useQuickCreate } from '../../hooks/useQuickCreate'
