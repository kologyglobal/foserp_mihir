import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { CRM_PAGE_TIP_FALLBACK, resolveCrmPageGuide } from '../../config/pageGuideRegistry'
import {
  dismissCrmPageTip,
  getCrmPageTipId,
  isCrmPageTipDismissed,
  isCrmPath,
} from '../../utils/crmPageTipStorage'
import { getPageLabel } from '../../utils/pageNavigation'
import { cn } from '../../utils/cn'

interface CrmPageTipProps {
  className?: string
}

/**
 * Compact CRM page tip — icon-only until opened; dismiss hides for this page (localStorage).
 */
export function CrmPageTip({ className }: CrmPageTipProps) {
  const { pathname } = useLocation()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const pageId = getCrmPageTipId(pathname)
  const [dismissed, setDismissed] = useState(() => isCrmPageTipDismissed(pageId))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDismissed(isCrmPageTipDismissed(pageId))
    setOpen(false)
  }, [pageId])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!isCrmPath(pathname) || dismissed) return null

  const guide = resolveCrmPageGuide(pathname) ?? CRM_PAGE_TIP_FALLBACK
  const title = getPageLabel(pathname) || 'Page tip'

  function handleDismiss() {
    dismissCrmPageTip(pageId)
    setDismissed(true)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('crm-page-tip relative inline-flex', className)}>
      <button
        type="button"
        className={cn(
          'crm-page-tip__trigger inline-flex h-7 w-7 items-center justify-center rounded-md border',
          'border-[var(--d365-border,#edebe9)] bg-[var(--d365-surface,#fff)] text-[var(--d365-muted,#8a8886)]',
          'transition-colors hover:border-[rgb(0_120_212_/_0.3)] hover:text-[#0078d4]',
          open && 'border-[rgb(0_120_212_/_0.35)] text-[#0078d4] bg-[rgb(0_120_212_/_0.06)]',
        )}
        aria-label={`Page tip for ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Tip: ${title}`}
          className={cn(
            'crm-page-tip__panel absolute left-0 top-[calc(100%+6px)] z-50 w-[min(22rem,calc(100vw-2rem))]',
            'rounded border border-[var(--d365-border-strong,#c8c6c4)] bg-[var(--d365-surface,#fff)]',
            'shadow-[0_4px_16px_rgb(0_0_0_/_0.12)]',
          )}
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
          <div className="flex items-center justify-end gap-2 border-t border-[var(--d365-border,#edebe9)] px-3 py-2">
            <button
              type="button"
              className="rounded px-2.5 py-1 text-[12px] font-medium text-[var(--d365-text-secondary,#605e5c)] hover:bg-[var(--d365-nav-hover,#f3f2f1)]"
              onClick={handleDismiss}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-[#0078d4] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#106ebe]"
              onClick={handleDismiss}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
