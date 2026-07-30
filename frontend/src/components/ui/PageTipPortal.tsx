import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { zIndex } from '../../design-system/theme/zIndex'
import { cn } from '../../utils/cn'

/** Fixed-position anchor for page-tip panels — renders above register filter bars (z-40). */
export function usePageTipAnchor(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null)
      return
    }

    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setCoords({ top: rect.bottom + 6, left: rect.left })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  return coords
}

type PageTipPortalProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  panelId: string
  className?: string
  children: ReactNode
}

export function PageTipPortal({ open, anchorRef, panelId, className, children }: PageTipPortalProps) {
  const coords = usePageTipAnchor(open, anchorRef)
  if (!open || !coords) return null

  return createPortal(
    <div
      id={panelId}
      role="tooltip"
      className={cn(
        'page-tip-portal w-[min(22rem,calc(100vw-2rem))]',
        'rounded border border-[var(--d365-border-strong,#c8c6c4)] bg-[var(--d365-surface,#fff)]',
        'shadow-[0_4px_16px_rgb(0_0_0_/_0.12)]',
        className,
      )}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: zIndex.tooltip,
      }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
