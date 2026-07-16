import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

interface ErpFactBoxPanelProps {
  title?: string
  children: ReactNode
  className?: string
  sticky?: boolean
}

/** Right-side FactBox rail for contextual summary */
export function ErpFactBoxPanel({ title = 'Details', children, className, sticky = true }: ErpFactBoxPanelProps) {
  return (
    <aside className={cn('erp-factbox-panel', sticky && 'erp-factbox-panel--sticky', className)}>
      {title ? <p className="erp-factbox-panel__title">{title}</p> : null}
      <div className="erp-factbox-panel__body">{children}</div>
    </aside>
  )
}

interface ErpFactBoxFieldProps {
  label: string
  value: ReactNode
}

export function ErpFactBoxField({ label, value }: ErpFactBoxFieldProps) {
  return (
    <div className="erp-factbox-field">
      <p className="erp-factbox-field__label">{label}</p>
      <p className="erp-factbox-field__value">{value}</p>
    </div>
  )
}
