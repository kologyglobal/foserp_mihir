import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AlertCircle, Check, CircleDot, Minus } from 'lucide-react'
import { cn } from '../../utils/cn'

/** Explicit section-completion states for Dynamics-style form nav. */
export type EnterpriseFormSectionStatus =
  | 'complete'
  | 'in_progress'
  | 'required'
  | 'optional'
  | 'error'

export interface EnterpriseFormSectionNavItem {
  id: string
  label: string
  icon?: LucideIcon
  /**
   * Legacy: when `status` is omitted, `true` → complete (green check),
   * `false`/undefined → no check (existing callers keep prior look).
   */
  done?: boolean
  /** Preferred explicit status. Green check only for `complete`. */
  status?: EnterpriseFormSectionStatus
}

const STATUS_LABEL: Record<EnterpriseFormSectionStatus, string> = {
  complete: 'Complete',
  in_progress: 'In progress',
  required: 'Required',
  optional: 'Optional',
  error: 'Error',
}

export function resolveEnterpriseFormSectionStatus(
  item: Pick<EnterpriseFormSectionNavItem, 'done' | 'status'>,
): EnterpriseFormSectionStatus | undefined {
  if (item.status) return item.status
  if (item.done === true) return 'complete'
  return undefined
}

function StatusGlyph({
  status,
  Icon,
}: {
  status: EnterpriseFormSectionStatus | undefined
  Icon?: LucideIcon
}) {
  if (status === 'complete') {
    return (
      <span className="dyn-form-section-nav__check" aria-hidden>
        <Check className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'required') {
    return (
      <span className="dyn-form-section-nav__badge dyn-form-section-nav__badge--required" aria-hidden>
        !
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="dyn-form-section-nav__badge dyn-form-section-nav__badge--error" aria-hidden>
        <AlertCircle className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="dyn-form-section-nav__badge dyn-form-section-nav__badge--in-progress" aria-hidden>
        <CircleDot className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'optional') {
    return (
      <span className="dyn-form-section-nav__badge dyn-form-section-nav__badge--optional" aria-hidden>
        <Minus className="h-3 w-3" />
      </span>
    )
  }
  if (Icon) {
    return <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
  }
  return null
}

export function EnterpriseFormSectionNav({
  sections,
  activeId,
  onSelect,
  trailing,
  className,
}: {
  sections: EnterpriseFormSectionNavItem[]
  activeId: string
  onSelect: (id: string) => void
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('dyn-form-section-nav-row', className)}>
      <nav className="dyn-form-section-nav" aria-label="Form sections">
        {sections.map((section) => {
          const Icon = section.icon
          const active = activeId === section.id
          const status = resolveEnterpriseFormSectionStatus(section)
          const statusLabel = status ? STATUS_LABEL[status] : undefined
          return (
            <button
              key={section.id}
              type="button"
              className={cn(
                'dyn-form-section-nav__tab',
                active && 'dyn-form-section-nav__tab--active',
                status && `dyn-form-section-nav__tab--${status}`,
              )}
              onClick={() => onSelect(section.id)}
              aria-current={active ? 'true' : undefined}
              aria-label={statusLabel ? `${section.label}, ${statusLabel}` : section.label}
            >
              <StatusGlyph status={status} Icon={Icon} />
              <span>{section.label}</span>
              {status && status !== 'complete' ? (
                <span className={cn('dyn-form-section-nav__status', `dyn-form-section-nav__status--${status}`)}>
                  {STATUS_LABEL[status]}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>
      {trailing ? <div className="dyn-form-section-nav__trailing">{trailing}</div> : null}
    </div>
  )
}
