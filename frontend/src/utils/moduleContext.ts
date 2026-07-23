/** Resolve active ERP module from route — used in shell chrome */
import { findActiveCategoryId, moduleCategories, navItemIsActive } from '../config/navigation'
import { getExperienceRoleLabel } from './permissions'

function findActiveNavLabel(pathname: string): string | null {
  const categoryId = findActiveCategoryId(pathname)
  if (!categoryId) return null
  const category = moduleCategories.find((c) => c.id === categoryId)
  if (!category) return null
  const activeItem = [...category.items]
    .reverse()
    .find((item) => !item.disabled && navItemIsActive(item, pathname))
  return activeItem?.label ?? null
}

export function getModuleFromPath(pathname: string): { module: string; area: string } {
  if (pathname === '/' || pathname === '' || pathname.startsWith('/home')) {
    return { module: getExperienceRoleLabel(), area: 'Role Home' }
  }

  const categoryId = findActiveCategoryId(pathname)
  if (categoryId) {
    const category = moduleCategories.find((c) => c.id === categoryId)
    if (category) {
      const activeLabel = findActiveNavLabel(pathname)
      return { module: category.title, area: activeLabel ?? 'Workspace' }
    }
  }

  if (pathname.startsWith('/settings')) return { module: 'Administration', area: 'Settings' }
  if (pathname.startsWith('/reports')) return { module: 'Reports', area: 'Analytics' }
  if (pathname.startsWith('/inbox')) return { module: 'Executive', area: 'Inbox' }

  return { module: 'Home', area: 'FOS ERP' }
}

function titleFromPathSegment(segment: string): string {
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getPageTitle(pathname: string): string {
  const navLabel = findActiveNavLabel(pathname)
  if (navLabel) {
    const isForm =
      pathname.endsWith('/new') ||
      pathname.endsWith('/edit') ||
      pathname.includes('/create') ||
      pathname.includes('/amend')
    if (isForm) {
      if (pathname.endsWith('/new')) return `New ${navLabel.replace(/s$/, '')}`
      if (pathname.endsWith('/edit')) return `Edit ${navLabel.replace(/s$/, '')}`
      if (pathname.includes('/amend')) return `Amend ${navLabel.replace(/s$/, '')}`
      if (pathname.includes('/create')) return `Create ${navLabel.replace(/s$/, '')}`
    }
    if (pathname.includes('/360')) return `${navLabel} 360`
    if (pathname.match(/\/[^/]+\/[^/]+$/)) return navLabel
    return navLabel
  }

  if (pathname === '/home' || pathname === '/') return 'Home Dashboard'
  if (pathname === '/executive') return 'Executive Control Tower'
  if (pathname === '/home/inbox') return 'Role Inbox'
  if (pathname === '/settings') return 'System Settings'

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 2) {
    return titleFromPathSegment(segments[segments.length - 1])
  }

  return ''
}
