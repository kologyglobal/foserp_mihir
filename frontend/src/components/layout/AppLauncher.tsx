import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { SIDEBAR_GROUPS, SIDEBAR_ICON_MENU } from '@/config/sidebarGroups'
import { getNavCategoryById } from '@/config/navigation'
import { getCategoryWorkspacePath } from '@/config/moduleWorkspaceNav'
import { useTenantModulesStore } from '@/store/tenantModulesStore'
import { canAccessAdminShell, canAccessPurchaseShell, isSuperAdminUser } from '@/utils/permissions'
import { canAccessModuleCategory } from '@/utils/permissions/moduleCategoryAccess'
import { cn } from '@/utils/cn'

type AppLauncherProps = {
  open: boolean
  onClose: () => void
}

/** Suite-bar waffle — main module menu (includes Maintenance as its own module). */
export function AppLauncher({ open, onClose }: AppLauncherProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isModuleEnabled = useTenantModulesStore((s) => s.isModuleEnabled)

  const modules = useMemo(
    () =>
      SIDEBAR_ICON_MENU.filter((item) => {
        if (item.categoryId === 'admin') return canAccessAdminShell()
        if (item.categoryId === 'platform') return isSuperAdminUser()
        if (item.categoryId === 'purchase') return canAccessPurchaseShell() && isModuleEnabled(item.categoryId)
        return canAccessModuleCategory(item.categoryId) && isModuleEnabled(item.categoryId)
      }),
    [isModuleEnabled],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="App launcher">
      <div className="absolute inset-0 bg-slate-900/25" />
      <div
        ref={panelRef}
        className="absolute left-3 top-[calc(var(--d365-suite-height,48px)+0.5rem)] w-[min(92vw,520px)] overflow-hidden rounded-xl border border-erp-border bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-erp-fg">Modules</h2>
            <p className="text-xs text-erp-muted">Open a workspace module</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-erp-muted hover:bg-slate-100 hover:text-erp-fg"
            onClick={onClose}
            aria-label="Close modules menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto p-4">
          {SIDEBAR_GROUPS.map((group) => {
            const items = modules.filter((m) => (group.categoryIds as readonly string[]).includes(m.categoryId))
            if (!items.length) return null
            return (
              <section key={group.id}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{group.label}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((item) => {
                    const category = getNavCategoryById(item.categoryId)
                    if (!category) return null
                    const to = getCategoryWorkspacePath(category)
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.categoryId}
                        to={to}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border border-erp-border bg-white px-3 py-2.5 text-left',
                          'hover:border-erp-primary/40 hover:bg-slate-50',
                          item.categoryId === 'maintenance' && 'ring-1 ring-erp-primary/20',
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-erp-primary">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-erp-fg">{item.label}</span>
                          <span className="block truncate text-[11px] text-erp-muted">{category.title}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
