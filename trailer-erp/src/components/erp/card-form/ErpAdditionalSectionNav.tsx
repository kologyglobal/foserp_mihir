import type { LucideIcon } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface ErpAdditionalSectionItem {
  id: string
  label: string
  /** Human status copy: "3 items", "Needs input", "No files", etc. */
  status: string
  /** Visual tone — only `missing` / `warn` should stand out */
  tone?: 'ok' | 'missing' | 'neutral' | 'warn'
  icon?: LucideIcon
}

export interface ErpAdditionalSectionNavProps {
  sections: ErpAdditionalSectionItem[]
  /** `null` / empty = no section expanded (collapsed by default) */
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
  /** Optional heading above the chips */
  title?: string
}

function resolveTone(section: ErpAdditionalSectionItem): NonNullable<ErpAdditionalSectionItem['tone']> {
  if (section.tone) return section.tone
  const s = section.status.toLowerCase()
  if (s.includes('need') || s.includes('missing') || s === 'overdue') return 'missing'
  if (s === '0' || s.startsWith('no ')) return 'neutral'
  return 'ok'
}

/**
 * Accordion-style navigator for Additional Information —
 * pick one section; do not expand the whole form at once.
 */
export function ErpAdditionalSectionNav({
  sections,
  activeId,
  onSelect,
  className,
  title = 'Browse sections',
}: ErpAdditionalSectionNavProps) {
  return (
    <div className={cn('erp-additional-section-nav', className)} role="tablist" aria-label={title || 'Additional sections'}>
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
