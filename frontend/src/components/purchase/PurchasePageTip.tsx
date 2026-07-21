import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import {
  PURCHASE_PAGE_TIP_FALLBACK,
  resolvePurchasePageGuide,
} from '../../config/pageGuideRegistry'
import { isPurchasePath } from '../../utils/purchasePageTip'
import { getPageLabel } from '../../utils/pageNavigation'
import { cn } from '../../utils/cn'

interface PurchasePageTipProps {
  className?: string
}

/**
 * Purchase Purpose / Next step as an info icon — content on hover (and keyboard focus).
 */
export function PurchasePageTip({ className }: PurchasePageTipProps) {
  const { pathname } = useLocation()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  if (!isPurchasePath(pathname)) return null

  const guide = resolvePurchasePageGuide(pathname) ?? PURCHASE_PAGE_TIP_FALLBACK
  const title = getPageLabel(pathname) || 'Purchase'

  function openTip() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      ref={rootRef}
      className={cn('purchase-page-tip relative inline-flex', open && 'z-[100]', className)}
      onMouseEnter={openTip}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(
          'purchase-page-tip__trigger inline-flex h-7 w-7 items-center justify-center rounded-md border',
          'border-[var(--d365-border,#edebe9)] bg-[var(--d365-surface,#fff)] text-[var(--d365-muted,#8a8886)]',
          'transition-colors hover:border-[rgb(0_120_212_/_0.3)] hover:text-[#0078d4]',
          open && 'border-[rgb(0_120_212_/_0.35)] text-[#0078d4] bg-[rgb(0_120_212_/_0.06)]',
        )}
        aria-label={`Page info for ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={openTip}
        onBlur={scheduleClose}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className={cn(
            'purchase-page-tip__panel absolute left-0 top-[calc(100%+6px)] z-[100] w-[min(22rem,calc(100vw-2rem))]',
            'rounded border border-[var(--d365-border-strong,#c8c6c4)] bg-[var(--d365-surface,#fff)]',
            'shadow-[0_4px_16px_rgb(0_0_0_/_0.12)]',
          )}
          onMouseEnter={openTip}
          onMouseLeave={scheduleClose}
        >
          <div className="border-b border-[var(--d365-border,#edebe9)] bg-[var(--d365-nav-bg,#faf9f8)] px-3 py-2">
            <p className="text-[13px] font-semibold leading-tight text-[var(--d365-text,#323130)]">{title}</p>
            <p className="mt-0.5 text-[11px] text-[var(--d365-muted,#8a8886)]">Page tip</p>
          </div>
          <div className="space-y-2 px-3 py-2.5 text-[13px] leading-snug text-[var(--d365-text,#323130)]">
            <p>
              <span className="font-semibold text-[#0078d4]">Purpose: </span>
              {guide.purpose}
            </p>
            {guide.nextStep ? (
              <p className="text-[var(--d365-text-secondary,#605e5c)]">
                <span className="font-semibold text-[var(--d365-text,#323130)]">Next step: </span>
                {guide.nextStep}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
