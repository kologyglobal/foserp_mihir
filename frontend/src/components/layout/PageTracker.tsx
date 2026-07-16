import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getPageLabel } from '../../utils/pageNavigation'
import { useUIStore } from '../../store/uiStore'

/** Tracks recent page visits for workspace tabs — stable pathname-only effect. */
export function PageTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname.startsWith('/print')) return
    useUIStore.getState().trackPageVisit({ path: pathname, label: getPageLabel(pathname) })
  }, [pathname])

  return null
}
