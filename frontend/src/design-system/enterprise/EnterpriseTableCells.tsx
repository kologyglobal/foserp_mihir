import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

/** Numeric table cell — 14px medium, right-aligned, tabular nums */
export function EnterpriseNumericCell({
  value,
  className,
  children,
}: {
  value?: string | number
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={cn('ent-td-numeric block ent-align-right', className)}>
      {children ?? value}
    </span>
  )
}

/** ID cell — 13px medium, primary color, single line */
export function EnterpriseIdCell({ id, className }: { id: string; className?: string }) {
  return (
    <span className={cn('ent-td-id whitespace-nowrap', className)} title={id}>
      {id}
    </span>
  )
}

export interface EnterpriseRecordCellProps {
  primary: ReactNode
  subtitle?: ReactNode
  location?: string
  industry?: string
  rating?: number
  className?: string
}

/** Primary 14px medium + secondary 12px regular gray */
export function EnterpriseRecordCell({
  primary,
  subtitle,
  location,
  industry,
  rating,
  className,
}: EnterpriseRecordCellProps) {
  const metaParts = [subtitle, location, industry].filter(Boolean)
  return (
    <div className={cn('ent-record-cell min-w-0', className)}>
      <p className="ent-record-cell__primary truncate">{primary}</p>
      {(metaParts.length > 0 || rating != null) ? (
        <div className="ent-record-cell__meta flex flex-wrap items-center">
          {metaParts.map((part, i) => (
            <span key={i}>{part}</span>
          ))}
          {rating != null && rating > 0 ? (
            <span aria-label={`${rating} star customer`}>{'★'.repeat(Math.min(5, rating))}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
