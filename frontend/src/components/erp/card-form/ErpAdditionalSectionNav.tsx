import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface ErpAdditionalSectionItem {
  id: string
  label: string
  /** Counter / status: "1", "3", "0", "Complete" */
  status: string
  tone?: 'ok' | 'missing' | 'neutral' | 'warn'
  icon?: LucideIcon
}

export interface ErpAdditionalSectionNavProps {
  sections: ErpAdditionalSectionItem[]
  /** `null` / empty = no section expanded */
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
  title?: string
  /**
   * `responsive` = tabs on desktop, accordion on mobile (preferred).
   * `chips` = legacy tile grid (nav only).
   * `tabs` / `accordion` = forced layout.
   */
  layout?: 'responsive' | 'tabs' | 'accordion' | 'chips'
  /** When provided, content renders under tabs / inside accordion items. */
  panels?: Record<string, ReactNode>
}

function resolveTone(section: ErpAdditionalSectionItem): NonNullable<ErpAdditionalSectionItem['tone']> {
  if (section.tone) return section.tone
  const s = section.status.toLowerCase()
  if (s.includes('need') || s.includes('missing') || s === 'overdue') return 'missing'
  if (s === '0' || s.startsWith('no ')) return 'neutral'
  return 'ok'
}

function useIsNarrow(breakpointPx = 900) {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [breakpointPx])

  return narrow
}

function TabButton({
  section,
  active,
  onSelect,
  withChevron,
}: {
  section: ErpAdditionalSectionItem
  active: boolean
  onSelect: (id: string) => void
  withChevron?: boolean
}) {
  const Icon = section.icon
  const tone = resolveTone(section)
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        'erp-additional-section-nav__tab',
        active && 'is-active',
        `erp-additional-section-nav__tab--${tone}`,
      )}
      onClick={() => onSelect(section.id)}
    >
      {Icon ? (
        <span className="erp-additional-section-nav__icon" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <span className="erp-additional-section-nav__label">{section.label}</span>
      <span className="erp-additional-section-nav__status">{section.status}</span>
      {withChevron ? (
        <ChevronDown
          className={cn('erp-additional-section-nav__chevron', active && 'is-open')}
          aria-hidden
        />
      ) : null}
    </button>
  )
}

/**
 * Additional Information section navigator —
 * desktop tabs + mobile accordion when panels are supplied.
 */
export function ErpAdditionalSectionNav({
  sections,
  activeId,
  onSelect,
  className,
  title = 'Browse sections',
  layout = 'responsive',
  panels,
}: ErpAdditionalSectionNavProps) {
  const narrow = useIsNarrow(900)
  const resolvedLayout =
    layout === 'responsive'
      ? (panels ? (narrow ? 'accordion' : 'tabs') : 'chips')
      : layout

  const activePanel = activeId && panels ? panels[activeId] : null

  if (resolvedLayout === 'chips' || !panels) {
    return (
      <div
        className={cn('erp-additional-section-nav erp-additional-section-nav--chips', className)}
        role="tablist"
        aria-label={title || 'Additional sections'}
      >
        {title ? <p className="erp-additional-section-nav__title">{title}</p> : null}
        <div className="erp-additional-section-nav__grid">
          {sections.map((section) => {
            const Icon = section.icon
            const active = section.id === activeId
            const tone = resolveTone(section)
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  'erp-additional-section-nav__chip',
                  active && 'is-active',
                  `erp-additional-section-nav__chip--${tone}`,
                )}
                onClick={() => onSelect(section.id)}
              >
                {Icon ? (
                  <span className="erp-additional-section-nav__icon" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <span className="erp-additional-section-nav__label">{section.label}</span>
                <span className="erp-additional-section-nav__status">{section.status}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (resolvedLayout === 'accordion') {
    return (
      <div
        className={cn('erp-additional-section-nav erp-additional-section-nav--accordion', className)}
        role="tablist"
        aria-label={title || 'Additional sections'}
      >
        {title ? <p className="erp-additional-section-nav__title">{title}</p> : null}
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <div
              key={section.id}
              className={cn('erp-additional-section-nav__acc-item', active && 'is-active')}
            >
              <TabButton section={section} active={active} onSelect={onSelect} withChevron />
              {active && panels[section.id] != null ? (
                <div
                  className="erp-additional-panel"
                  role="tabpanel"
                  id={`erp-additional-panel-${section.id}`}
                  aria-label={section.label}
                >
                  {panels[section.id]}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  // tabs (desktop)
  return (
    <div
      className={cn('erp-additional-section-nav erp-additional-section-nav--tabs', className)}
      aria-label={title || 'Additional sections'}
    >
      {title ? <p className="erp-additional-section-nav__title">{title}</p> : null}
      <div className="erp-additional-section-nav__tablist" role="tablist">
        {sections.map((section) => (
          <TabButton
            key={section.id}
            section={section}
            active={section.id === activeId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {activePanel != null ? (
        <div
          className="erp-additional-panel erp-additional-panel--tab"
          role="tabpanel"
          id={activeId ? `erp-additional-panel-${activeId}` : undefined}
          aria-label={sections.find((s) => s.id === activeId)?.label}
        >
          {activePanel}
        </div>
      ) : (
        <p className="erp-additional-section-nav__empty">Select a section to view details.</p>
      )}
    </div>
  )
}
