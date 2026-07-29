import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { getModuleFromPath, getPageTitle } from '../../utils/moduleContext'
import { GlobalSearchTrigger } from '../design-system/GlobalSearch'
import { NotificationBell } from '../design-system/NotificationPanel'
import { UserMenuDropdown } from './UserMenuDropdown'
import { cn } from '../../utils/cn'

export function Topbar() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const { pathname } = useLocation()
  const { module, area } = getModuleFromPath(pathname)
  const pageTitle = getPageTitle(pathname)
  const [refreshing, setRefreshing] = useState(false)

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    window.location.reload()
  }

  return (
    <header
      className={cn(
        'erp-topbar fixed top-0 z-20 flex h-[var(--erp-topbar-height)] items-center border-b border-erp-border shadow-sm',
        sidebarCollapsed ? 'left-[var(--erp-sidebar-collapsed)]' : 'left-[var(--erp-sidebar-width)]',
        'right-0 transition-all duration-200',
      )}
    >
      <div className="flex h-full w-full items-center gap-3 px-4">
        <div className="hidden min-w-0 shrink-0 flex-col sm:flex">
          <span className="erp-topbar-title truncate">{pageTitle || module}</span>
          <span className="erp-topbar-breadcrumb truncate">
            {module} · {area}
          </span>
        </div>

        <div className="mx-auto hidden max-w-xl flex-1 md:flex">
          <GlobalSearchTrigger className="w-full min-w-0" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="erp-type-caption hidden xl:inline">{today}</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-erp-surface text-erp-muted shadow-sm transition-all hover:border-erp-primary/30 hover:bg-erp-primary-soft hover:text-erp-primary hover:shadow-erp disabled:opacity-60"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <NotificationBell />
          <UserMenuDropdown />
        </div>
      </div>
    </header>
  )
}

export const TopNav = Topbar
