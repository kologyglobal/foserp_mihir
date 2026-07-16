import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

interface ErpFieldLabelProps {
  children: ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
}

export function ErpFieldLabel({ children, required, htmlFor, className }: ErpFieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('erp-field-label', className)}>
      <span className="erp-field-label__text">{children}</span>
      {required ? <span className="erp-field-label__required" aria-hidden>*</span> : null}
    </label>
  )
}
