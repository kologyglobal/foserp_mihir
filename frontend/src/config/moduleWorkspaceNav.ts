import type { LucideIcon } from 'lucide-react'
import {
  categoryIsActive,
  findActiveCategoryId,
  navItemIsActive,
  moduleCategories,
  type NavCategory,
} from './navigation'
import { canViewPurchaseNavItem } from '../utils/permissions/purchase'
import { canViewInventoryNavItem } from '../utils/permissions/inventory'

/** Default landing route for a module category */
export function getCategoryWorkspacePath(category: NavCategory): string {
  const visibleItems = category.items.filter((item) => {
    if (item.disabled) return false
    if (category.id === 'purchase') return canViewPurchaseNavItem(item.path)
    if (category.id === 'inventory') return canViewInventoryNavItem(item.path)
    return true
  })
  const workspace = visibleItems.find((item) => item.workspace)
  if (workspace) return workspace.path
  const first = visibleItems[0]
  return first?.path ?? '/home'
}

export type ModuleSubNavItem = {
  label: string
  path: string
  end?: boolean
  group?: string
  icon?: LucideIcon
}

/** Workspace sub-menu for the active module — drives the Zoho-style vertical module rail */
export function getModuleSubNavForPath(pathname: string): {
  categoryId: string
  categoryTitle: string
  base: string
  items: ModuleSubNavItem[]
} | null {
  /** Finance settings uses local DynamicsTabs in FinanceSettingsShell — avoid conflicting module tabs. */
  if (pathname.startsWith('/accounting/settings')) return null

  const categoryId = findActiveCategoryId(pathname)
  if (!categoryId) return null
  const category = moduleCategories.find((c) => c.id === categoryId)
  if (!category) return null

  const base = getCategoryWorkspacePath(category)
  const items = category.items
    .filter((item) => {
      if (item.disabled || item.subNav === false) return false
      // Soft UI gate — backend must enforce when purchase API exists
      if (category.id === 'purchase') return canViewPurchaseNavItem(item.path)
      if (category.id === 'inventory') return canViewInventoryNavItem(item.path)
      return true
    })
    .map((item) => ({
      label: item.label,
      path: item.path,
      end: item.end,
      group: item.group,
      icon: item.icon,
    }))

  return { categoryId, categoryTitle: category.title, base, items }
}

export function moduleHeaderIsActive(category: NavCategory, pathname: string): boolean {
  return categoryIsActive(category, pathname)
}

export function subNavItemIsActive(pathname: string, item: ModuleSubNavItem): boolean {
  if (item.end) return pathname === item.path
  // BOM / routing editors use sibling version routes under /manufacturing/setup/*.
  if (item.path === '/manufacturing/setup/boms') {
    return (
      pathname === item.path ||
      pathname.startsWith(`${item.path}/`) ||
      pathname.startsWith('/manufacturing/setup/bom-versions')
    )
  }
  if (item.path === '/manufacturing/setup/routings') {
    return (
      pathname === item.path ||
      pathname.startsWith(`${item.path}/`) ||
      pathname.startsWith('/manufacturing/setup/routing-versions')
    )
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

/** Resolve which sub-nav paths belong to a module (for tests and search) */
export function getAllModuleSubNavBases(): string[] {
  return moduleCategories.map(getCategoryWorkspacePath)
}

export function findCategoryByPath(pathname: string): NavCategory | null {
  const id = findActiveCategoryId(pathname)
  return moduleCategories.find((c) => c.id === id) ?? null
}

export function pathnameInCategory(pathname: string, category: NavCategory): boolean {
  return category.items.some((item) => navItemIsActive(item, pathname))
}
