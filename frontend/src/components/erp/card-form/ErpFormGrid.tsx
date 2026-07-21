import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

export type ErpFormGridColumns = 1 | 2 | 3 | 4

export interface ErpFormGridProps {
  children: ReactNode
  /** Desktop columns. Tablet collapses to 2 (when 3/4), mobile to 1. */
  columns?: ErpFormGridColumns
  dense?: boolean
  className?: string
}

/**
 * Standard responsive form field grid.
 * Desktop 3 → tablet 2 → mobile 1 (when columns=3).
 * Desktop 4 → tablet 2 → mobile 1 (when columns=4).
 */
export function ErpFormGrid({
  children,
  columns = 3,
  dense = true,
  className,
}: ErpFormGridProps) {
  return (
    <div
      className={cn(
        'erp-form-grid',
        dense && 'erp-form-grid--dense',
        columns === 1 && 'erp-form-grid--cols-1',
        columns === 2 && 'erp-form-grid--cols-2',
        columns === 3 && 'erp-form-grid--cols-3',
        columns === 4 && 'erp-form-grid--cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface ErpFormSpanProps {
  children: ReactNode
  /** Column span on desktop (clamped by grid). */
  span?: 1 | 2 | 3 | 4
  className?: string
}

/** Span helper for wide fields (notes, addresses, company search). */
export function ErpFormSpan({ children, span = 1, className }: ErpFormSpanProps) {
  return (
    <div
      className={cn(
        'erp-form-span',
        span === 2 && 'erp-form-span--2',
        (span === 3 || span === 4) && 'erp-form-span--3',
        className,
      )}
    >
      {children}
    </div>
  )
}
