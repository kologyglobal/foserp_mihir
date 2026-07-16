import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

interface ErpFieldControlProps {
  children: ReactNode
  readOnly?: boolean
  disabled?: boolean
  className?: string
}

export function ErpFieldControl({ children, readOnly, disabled, className }: ErpFieldControlProps) {
  return (
    <div
      className={cn(
        'erp-field-control',
        readOnly && 'erp-field-control--readonly',
        disabled && 'erp-field-control--disabled',
        className,
      )}
    >
      {children}
    </div>
  )
}
