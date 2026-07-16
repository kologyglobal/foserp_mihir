import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardFeedItem, DashboardQuickView } from '../../types/dashboardInteraction'

export function useDashboardNavigation() {
  const navigate = useNavigate()
  const [quickView, setQuickView] = useState<DashboardQuickView | null>(null)
  const [quickViewHref, setQuickViewHref] = useState<string | undefined>()

  const closeQuickView = useCallback(() => {
    setQuickView(null)
    setQuickViewHref(undefined)
  }, [])

  const openQuickView = useCallback((view: DashboardQuickView, href?: string) => {
    setQuickView(view)
    setQuickViewHref(href)
  }, [])

  const openFeedItem = useCallback(
    (item: DashboardFeedItem) => {
      if (item.quickView) {
        openQuickView(item.quickView, item.href)
      } else if (item.href) {
        navigate(item.href)
      }
    },
    [navigate, openQuickView],
  )

  const openHref = useCallback(
    (href: string, view?: DashboardQuickView) => {
      if (view) openQuickView(view, href)
      else navigate(href)
    },
    [navigate, openQuickView],
  )

  return {
    quickView,
    quickViewHref,
    openFeedItem,
    openQuickView,
    openHref,
    closeQuickView,
    navigate,
  }
}

export type DashboardNavigation = ReturnType<typeof useDashboardNavigation>
