import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CrmLeadFormFieldProps {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
  colSpan?: 1 | 2
}

/** BC-style field row — caption above control, Dynamics font scale */
export function CrmLeadFormField({
  label,
  required,
  hint,
  children,
  className,
  colSpan = 1,
}: CrmLeadFormFieldProps) {
  return (
    <div
      className={cn(
        'crm-lead-field',
        colSpan === 2 && 'crm-lead-field--wide',
        className,
      )}
    >
      <label className="crm-lead-field__label">
        {label}
        {required ? <span className="crm-lead-field__required" aria-hidden>*</span> : null}
      </label>
      <div className="crm-lead-field__control">{children}</div>
      {hint ? <p className="crm-lead-field__hint">{hint}</p> : null}
    </div>
  )
}
