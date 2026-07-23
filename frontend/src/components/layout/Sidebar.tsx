import { useEffect, useMemo, type ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { getNavCategoryById } from '../../config/navigation'
import { getCategoryWorkspacePath, moduleHeaderIsActive } from '../../config/moduleWorkspaceNav'
import { SIDEBAR_ICON_MENU } from '../../config/sidebarGroups'
import { cn } from '../../utils/cn'
import { useUIStore } from '../../store/uiStore'
import { useTenantModulesStore } from '../../store/tenantModulesStore'
import { ModuleNavigationBadge } from '../premium/ModuleNavigationBadge'
import { useSidebarLiveCounts } from '../../hooks/useSidebarLiveCounts'
import { canAccessAdminShell, canAccessPurchaseShell, isSuperAdminUser } from '../../utils/permissions'

function IconMenuItem({
  categoryId,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
  liveCount,
}: {
  categoryId: string
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  collapsed: boolean
  onNavigate?: () => void
  liveCount: number
}) {
  const { pathname } = useLocation()
  const category = getNavCategoryById(categoryId)
  if (!category) return null

  const path = getCategoryWorkspacePath(category)
  const isActive = moduleHeaderIsActive(category, pathname)

  return (
    <NavLink
      to={path}
      onClick={onNavigate}
      className={cn('erp-nav-icon-menu-item', isActive && 'erp-nav-icon-menu-item-active')}
      title={label}
    >
      <span className="erp-nav-icon-menu-icon">
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
        {liveCount > 0 && (
          <ModuleNavigationBadge
            count={liveCount}
            capAt={9}
            tone="alert"
            className="erp-nav-icon-menu-badge !absolute !top-[-2px] !right-[-6px] !min-w-4 !h-4 !px-1 !py-0 !text-[9px] !leading-4 !bg-[#e81123] !text-white !ring-0"
          />
        )}
      </span>
      {!collapsed && <span className="erp-nav-icon-menu-label">{label}</span>}
    </NavLink>
  )
}

/** Left nav — icon rail with labels; page links live in workspace sub-nav */
export function Sidebar() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen)
  const closeMobileNav = useUIStore((s) => s.closeMobileNav)
  const { pathname } = useLocation()
  const isModuleEnabled = useTenantModulesStore((s) => s.isModuleEnabled)

  const sidebarCounts = useSidebarLiveCounts()

  useEffect(() => {
    closeMobileNav()
  }, [pathname, closeMobileNav])

  const closeIfMobile = () => closeMobileNav()

  const menuItems = useMemo(
    () =>
      SIDEBAR_ICON_MENU
        .filter((item) => {
          if (item.categoryId === 'admin') return canAccessAdminShell()
          if (item.categoryId === 'platform') return isSuperAdminUser()
          // Soft UI gate only — purchase API must re-enforce when it ships
          if (item.categoryId === 'purchase') return canAccessPurchaseShell() && isModuleEnabled(item.categoryId)
          return isModuleEnabled(item.categoryId)
        })
        .map((item) => ({
          ...item,
          liveCount: sidebarCounts[item.categoryId] ?? 0,
        })),
    [sidebarCounts, isModuleEnabled],
  )

  const showLabels = !sidebarCollapsed || mobileNavOpen

  return (
    <aside
      className={cn(
        'erp-sidebar erp-sidebar--icon-menu d365-nav-pane fixed left-0 z-30 flex flex-col border-r transition-all duration-200',
        mobileNavOpen && 'erp-sidebar-mobile-open',
        sidebarCollapsed && !mobileNavOpen
          ? 'md:w-[var(--erp-sidebar-collapsed)] max-md:w-[min(85vw,280px)]'
          : 'md:w-[var(--erp-sidebar-width)] max-md:w-[min(85vw,280px)]',
      )}
    >
      <div className="erp-sidebar-brand erp-sidebar-brand--icon-menu md:hidden">
        <button
          type="button"
          onClick={closeMobileNav}
          className="erp-sidebar-toggle"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="erp-sidebar-nav flex flex-1 flex-col overflow-hidden">
        <div className="erp-sidebar-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="erp-nav-icon-menu">
            {menuItems.map((item) => (
              <IconMenuItem
                key={item.categoryId}
                categoryId={item.categoryId}
                label={item.label}
                icon={item.icon}
                collapsed={!showLabels}
                onNavigate={closeIfMobile}
                liveCount={item.liveCount}
              />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  )
}
