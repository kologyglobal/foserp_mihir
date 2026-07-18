import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll on pathname change — window + primary workspace scroll container. */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    // AppShell scrolls inside `.d365-workspace-content` (overflow-y: auto), not the window.
    const mainScroll = document.querySelector<HTMLElement>('.d365-workspace-content')
    mainScroll?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
