import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { cn } from '../../utils/cn'

/** Show only after the user has scrolled this far (and content can scroll that far). */
const SCROLL_THRESHOLD_PX = 500
const WORKSPACE_SCROLL_SELECTOR = '.d365-workspace-content'

function getWorkspaceScrollEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(WORKSPACE_SCROLL_SELECTOR)
}

function getScrollTop(el: HTMLElement | null): number {
  if (el && el.scrollHeight > el.clientHeight + 4) return el.scrollTop
  return window.scrollY || document.documentElement.scrollTop
}

function getScrollableDistance(el: HTMLElement | null): number {
  if (el && el.scrollHeight > el.clientHeight + 4) {
    return Math.max(0, el.scrollHeight - el.clientHeight)
  }
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
}

/**
 * Global back-to-top control — listens to `.d365-workspace-content` (AppShell scroll)
 * with a window fallback. Hidden on short pages and until scroll passes the threshold.
 */
export function BackToTopButton() {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)

  const updateVisibility = useCallback(() => {
    const workspace = getWorkspaceScrollEl()
    const scrollable = getScrollableDistance(workspace)
    if (scrollable < SCROLL_THRESHOLD_PX) {
      setVisible(false)
      return
    }
    setVisible(getScrollTop(workspace) >= SCROLL_THRESHOLD_PX)
  }, [])

  useEffect(() => {
    setVisible(false)
    const frame = requestAnimationFrame(updateVisibility)
    return () => cancelAnimationFrame(frame)
  }, [pathname, updateVisibility])

  useEffect(() => {
    const workspace = getWorkspaceScrollEl()
    const onScrollOrResize = () => updateVisibility()

    workspace?.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })

    const ro =
      typeof ResizeObserver !== 'undefined' && workspace
        ? new ResizeObserver(onScrollOrResize)
        : null
    if (workspace && ro) {
      ro.observe(workspace)
      const child = workspace.firstElementChild
      if (child) ro.observe(child)
    }

    updateVisibility()

    return () => {
      workspace?.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
      ro?.disconnect()
    }
  }, [pathname, updateVisibility])

  const scrollToTop = () => {
    const workspace = getWorkspaceScrollEl()
    workspace?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      className={cn('d365-back-to-top', visible && 'd365-back-to-top--visible')}
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.25} aria-hidden />
    </button>
  )
}
