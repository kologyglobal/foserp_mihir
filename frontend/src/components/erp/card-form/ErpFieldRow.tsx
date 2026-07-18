import type { ReactNode } from 'react'
import { ErpFieldLabel } from './ErpFieldLabel'
import { ErpFieldControl } from './ErpFieldControl'
import { cn } from '../../../utils/cn'

interface ErpFieldRowProps {
  /** DOM id for scroll-into-view on validation reveal */
  id?: string
  /**
   * Stable field key for shared form validation (`data-field`).
   * Used by `focusFirstInvalidField` / `handleInvalidSubmit`.
   */
  dataField?: string
  label: string
  required?: boolean
  hint?: string
  fieldError?: string
  fieldState?: 'idle' | 'error' | 'success'
  readOnly?: boolean
  disabled?: boolean
  /** 1 = single cell; 2 or 3 = full row width (Fiori multi-col grids) */
  colSpan?: 1 | 2 | 3
  horizontal?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}

/**
 * BC-style dense field row.
 * horizontal=true → label left, control right with dotted connector.
 */
export function ErpFieldRow({
  id,
  dataField,
  label,
  required,
  hint,
  fieldError,
  fieldState = 'idle',
  readOnly,
  disabled,
  colSpan = 1,
  horizontal = true,
  children,
  className,
  htmlFor,
}: ErpFieldRowProps) {
  return (
    <div
      id={id}
      data-field={dataField}
      className={cn(
        'erp-field-row',
        horizontal && 'erp-field-row--horizontal',
        (colSpan === 2 || colSpan === 3) && 'erp-field-row--wide',
        fieldState === 'error' && 'erp-field-row--error',
        fieldState === 'success' && 'erp-field-row--success',
        className,
      )}
    >
      <ErpFieldLabel required={required} htmlFor={htmlFor}>
        {label}
      </ErpFieldLabel>
      {horizontal ? <span className="erp-field-row__dots" aria-hidden /> : null}
      <div className="erp-field-row__control-wrap">
        <ErpFieldControl readOnly={readOnly} disabled={disabled}>
          {children}
        </ErpFieldControl>
        {fieldError ? <p className="erp-field-row__error">{fieldError}</p> : null}
        {hint && !fieldError ? <p className="erp-field-row__hint">{hint}</p> : null}
      </div>
    </div>
  )
}
