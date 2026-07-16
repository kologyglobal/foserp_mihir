import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface BulkAction {
  id: string
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function BulkActionToolbar({
  count,
  entityLabel = 'selected',
  actions,
  onClear,
  moreActions,
  className,
}: {
  count: number
  entityLabel?: string
  actions: BulkAction[]
  onClear: () => void
  moreActions?: ReactNode
  className?: string
}) {
  if (count <= 0) return null

  return (
    <div className={cn('ent-bulk-bar ent-bulk-bar--toolbar', className)} role="toolbar" aria-label="Bulk actions">
      <span className="ent-bulk-bar__count">
        {count} {entityLabel}
      </span>
      <span className="ent-bulk-bar__sep" aria-hidden />
      <div className="ent-bulk-bar__actions">
        {actions.map((action, index) => (
          <span key={action.id} className="ent-bulk-bar__action-wrap">
            {index > 0 ? <span className="ent-bulk-bar__dot" aria-hidden>·</span> : null}
            <button
              type="button"
              className={cn('ent-bulk-bar__btn', action.danger && 'ent-bulk-bar__btn--danger')}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </span>
        ))}
        {moreActions ? (
          <button type="button" className="ent-bulk-bar__btn ent-bulk-bar__btn--more">
            More <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <button type="button" className="ent-bulk-bar__clear" onClick={onClear}>
        Clear
      </button>
    </div>
  )
}
