import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { ErpFormGrid, type ErpFormGridColumns } from './ErpFormGrid'

export interface ErpFieldGroupProps {
  /** Optional uppercase section micro-label (e.g. Contact, Ownership). */
  label?: string
  children: ReactNode
  columns?: ErpFormGridColumns
  className?: string
}

/**
 * Sub-group inside Quick Entry — keeps related fields together with a light divider.
 */
export function ErpFieldGroup({
  label,
  children,
  columns = 3,
  className,
}: ErpFieldGroupProps) {
  return (
    <div className={cn('erp-field-group', className)}>
      {label ? <p className="erp-field-group__label">{label}</p> : null}
      <ErpFormGrid columns={columns} className="erp-field-group__grid">
        {children}
      </ErpFormGrid>
    </div>
  )
}
