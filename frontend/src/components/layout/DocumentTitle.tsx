import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getModuleFromPath, getPageTitle } from '../../utils/moduleContext'
import { getPageLabel } from '../../utils/pageNavigation'

const APP_BRAND = 'FOS ERP'

function specialDocumentTitle(pathname: string): string | null {
  // /login title is owned by LoginPage (tenant-aware).
  if (pathname === '/login' || pathname === '/signin') return null
  if (pathname.includes('change-password')) return `Change password — ${APP_BRAND}`
  if (pathname.startsWith('/m/') || pathname.startsWith('/mobile')) {
    return `${getPageLabel(pathname)} — Mobile`
  }
  return null
}

/** Browser tab title: active page + module so tabs show where you are. */
export function DocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname.startsWith('/print')) return
    if (pathname === '/login' || pathname === '/signin') return

    const special = specialDocumentTitle(pathname)
    if (special) {
      document.title = special
      return
    }

    const page = getPageTitle(pathname).trim() || getPageLabel(pathname).trim()
    const { module } = getModuleFromPath(pathname)
    if (page && module && page !== module) {
      document.title = `${page} — ${module}`
      return
    }
    if (page) {
      document.title = `${page} — ${APP_BRAND}`
      return
    }
    document.title = `${module || APP_BRAND} — ${APP_BRAND}`
  }, [pathname])

  return null
}
