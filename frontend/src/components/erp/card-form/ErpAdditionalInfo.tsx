import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../utils/cn'

/** e.g. "5 sections · 2 need attention" */
export function formatAdditionalInfoSummary(sectionCount: number, attentionCount = 0): string {
  const sectionsLabel = `${sectionCount} section${sectionCount === 1 ? '' : 's'}`
  if (attentionCount <= 0) return sectionsLabel
  return `${sectionsLabel} · ${attentionCount} need attention`
}

export interface ErpAdditionalInfoToggleProps {
  open: boolean
  onToggle: () => void
  panelId?: string
  /** Always shown — default "Additional Information" */
  title?: string
  /**
   * Status line under the title.
   * Prefer `sectionCount` / `attentionCount` when available.
   */
  summary?: string
  /** Total additional sections (builds summary when `summary` omitted) */
  sectionCount?: number
  /** Sections that still need attention / are Missing */
  attentionCount?: number
  /** @deprecated Use `summary` / section counts */
  hint?: string
  /** @deprecated Badge removed from UI — ignored */
  badge?: string
  /** @deprecated Title no longer changes when open */
  collapseTitle?: string
  className?: string
}

/**
 * Progressive disclosure control — expand optional / advanced form sections.
 */
export function ErpAdditionalInfoToggle({
  open,
  onToggle,
  panelId,
  title = 'Additional Information',
  summary,
  sectionCount,
  attentionCount = 0,
  hint,
  className,
}: ErpAdditionalInfoToggleProps) {
  const resolvedSummary =
    summary
    ?? (typeof sectionCount === 'number'
      ? formatAdditionalInfoSummary(sectionCount, attentionCount)
      : hint)

  return (
    <div className={cn('erp-additional-info-toggle-wrap', className)}>
      <button
        type="button"
        className={cn('erp-additional-info-toggle', open && 'is-open')}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="erp-additional-info-toggle__copy">
          <span className="erp-additional-info-toggle__title">{title}</span>
          {resolvedSummary ? (
            <span className="erp-additional-info-toggle__summary">{resolvedSummary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('erp-additional-info-toggle__chevron h-4 w-4', open && 'is-open')}
          aria-hidden
        />
      </button>
    </div>
  )
}

export interface ErpAdditionalInfoPanelProps {
  open: boolean
  id?: string
  children: ReactNode
  className?: string
  /** Scroll into view when opening */
  scrollOnOpen?: boolean
}

/** Animated reveal panel for additional form sections. */
export function ErpAdditionalInfoPanel({
  open,
  id,
  children,
  className,
  scrollOnOpen = true,
}: ErpAdditionalInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(open)

  useEffect(() => {
    if (scrollOnOpen && open && !wasOpen.current) {
      window.setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 40)
    }
    wasOpen.current = open
  }, [open, scrollOnOpen])

  return (
    <div
      id={id}
      ref={panelRef}
      className={cn('erp-additional-info-panel', open && 'is-open', className)}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="erp-additional-info-panel__inner">{children}</div>
    </div>
  )
}

export interface UseErpAdditionalInfoOptions {
  /** Force open (e.g. stage requires advanced fields). */
  forceOpen?: boolean
  /** Edit mode with optional data already filled — open by default. */
  preferOpen?: boolean
  defaultOpen?: boolean
}

/** Shared open-state for Additional Information. */
export function useErpAdditionalInfo(options: UseErpAdditionalInfoOptions = {}) {
  const { forceOpen = false, preferOpen = false, defaultOpen = false } = options
  const [open, setOpen] = useState(defaultOpen || forceOpen || preferOpen)
  const reactId = useId()
  const panelId = `erp-additional-info-${reactId.replace(/:/g, '')}`
  const preferApplied = useRef(false)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  useEffect(() => {
    if (!preferOpen || preferApplied.current) return
    preferApplied.current = true
    setOpen(true)
  }, [preferOpen])

  function toggle() {
    if (forceOpen) return
    setOpen((v) => !v)
  }

  return { open, setOpen, toggle, panelId }
}
