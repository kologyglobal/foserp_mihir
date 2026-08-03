import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getModuleFromPath, getPageTitle } from '../../utils/moduleContext'
import { getPageLabel } from '../../utils/pageNavigation'
import { getStoredSession } from '../../services/api/client'
import {
  APP_BRAND_FALLBACK,
  resolveTenantDisplayName,
  useTenantProfileStore,
} from '../../store/tenantProfileStore'

/** Standard browser tab format: active page — tenant name */
export function formatAppDocumentTitle(pageLabel: string, tenantName?: string | null): string {
  const page = pageLabel.trim() || APP_BRAND_FALLBACK
  const tenant = (tenantName?.trim() || resolveTenantDisplayName()).trim() || APP_BRAND_FALLBACK
  if (page === tenant) return page
  return `${page} — ${tenant}`
}

function resolveActivePageLabel(pathname: string): string {
  const page = getPageTitle(pathname).trim() || getPageLabel(pathname).trim()
  if (page) return page
  const { module, area } = getModuleFromPath(pathname)
  if (area && area !== 'Workspace' && area !== module) return area
  return module || APP_BRAND_FALLBACK
}

/**
 * Browser tab title for the entire app: active page + tenant name.
 * Login/public auth views own their own titles (LoginPage is tenant-aware).
 * Print routes leave title alone (PDF export mutates it temporarily).
 */
export function DocumentTitle() {
  const { pathname } = useLocation()
  const tenantName = useTenantProfileStore((s) => s.tenantName)
  const tradeName = useTenantProfileStore((s) => s.companyProfile?.tradeName)
  const legalName = useTenantProfileStore((s) => s.companyProfile?.legalName)

  useEffect(() => {
    if (pathname.startsWith('/print')) return
    if (pathname === '/login' || pathname === '/signin') return

    const session = getStoredSession()
    const tenant = resolveTenantDisplayName({
      sessionTenantName: session?.tenantName,
      sessionTenantSlug: session?.tenantSlug,
    })
      || tenantName
      || tradeName
      || legalName
      || APP_BRAND_FALLBACK

    if (pathname.includes('change-password')) {
      document.title = formatAppDocumentTitle('Change password', tenant)
      return
    }

    if (pathname.startsWith('/m/') || pathname.startsWith('/mobile')) {
      const mobilePage = getPageLabel(pathname).trim() || 'Mobile'
      document.title = formatAppDocumentTitle(mobilePage, tenant)
      return
    }

    document.title = formatAppDocumentTitle(resolveActivePageLabel(pathname), tenant)
  }, [pathname, tenantName, tradeName, legalName])

  return null
}
