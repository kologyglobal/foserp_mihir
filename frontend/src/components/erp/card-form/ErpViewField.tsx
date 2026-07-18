import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

const EMPTY = 'Not provided'

function isBlank(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') {
    const t = value.trim()
    return t === '' || t === '—' || t === 'Date not available' || t === 'Not provided'
  }
  return false
}

export interface ErpViewFieldProps {
  label: string
  /** Plain text / number value. Prefer `children` for custom content (links, badges). */
  value?: ReactNode
  children?: ReactNode
  emptyLabel?: string
  colSpan?: 1 | 2 | 3
  className?: string
  hideIfEmpty?: boolean
  /** Short helper — shown under the value and as native tooltip on the label. */
  hint?: string
}

/**
 * View-mode field: stacked label + clean value (no disabled inputs).
 */
export function ErpViewField({
  label,
  value,
  children,
  emptyLabel = EMPTY,
  colSpan = 1,
  className,
  hideIfEmpty = false,
  hint,
}: ErpViewFieldProps) {
  const hasChildren = children !== undefined && children !== null && children !== false
  const content = hasChildren ? children : value
  const empty = !hasChildren && isBlank(value)

  if (empty && hideIfEmpty) return null

  return (
    <div
      className={cn(
        'erp-view-field',
        colSpan === 2 && 'erp-view-field--span-2',
        colSpan === 3 && 'erp-view-field--span-3',
        empty && 'erp-view-field--empty',
        className,
      )}
    >
      <div className="erp-view-field__label" title={hint || undefined}>
        {label}
      </div>
      <div className="erp-view-field__value">
        {empty ? <span className="erp-view-field__empty">{emptyLabel}</span> : content}
      </div>
      {hint ? <p className="erp-view-field__hint">{hint}</p> : null}
    </div>
  )
}

export function ErpViewPhone({
  label = 'Mobile',
  value,
  colSpan,
  className,
  emptyLabel,
}: {
  label?: string
  value?: string | null
  colSpan?: 1 | 2 | 3
  className?: string
  emptyLabel?: string
}) {
  const phone = value?.trim()
  if (!phone) {
    return (
      <ErpViewField
        label={label}
        colSpan={colSpan}
        className={className}
        value={undefined}
        emptyLabel={emptyLabel}
      />
    )
  }
  return (
    <ErpViewField label={label} colSpan={colSpan} className={className}>
      <a href={`tel:${phone}`} className="erp-view-field__link" title={phone}>
        {phone}
      </a>
    </ErpViewField>
  )
}

export function ErpViewEmail({
  label = 'Email',
  value,
  colSpan,
  className,
  emptyLabel,
}: {
  label?: string
  value?: string | null
  colSpan?: 1 | 2 | 3
  className?: string
  emptyLabel?: string
}) {
  const email = value?.trim()
  if (!email) {
    return (
      <ErpViewField
        label={label}
        colSpan={colSpan}
        className={className}
        value={undefined}
        emptyLabel={emptyLabel}
      />
    )
  }
  return (
    <ErpViewField label={label} colSpan={colSpan} className={className}>
      <a
        href={`mailto:${email}`}
        className="erp-view-field__link erp-view-field__link--truncate"
        title={email}
      >
        {email}
      </a>
    </ErpViewField>
  )
}
