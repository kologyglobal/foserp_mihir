import { Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Input } from '../../components/forms/Inputs'
import { FormField, inputClassName } from '../../components/forms/FormField'

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

/**
 * Standard ERP date control — same height/border as Select, calendar affordance on the right.
 * Native picker remains accessible via the full field / indicator hit area.
 */
export function DatePicker({ label, error, hint, required, className, disabled, ...props }: DatePickerProps) {
  const field = (
    <div className={cn('erp-date-field', disabled && 'erp-date-field--disabled', className)}>
      <Input
        type="date"
        error={Boolean(error)}
        disabled={disabled}
        className={cn('erp-date-field__input', inputClassName(Boolean(error)))}
        {...props}
      />
      <Calendar className="erp-date-field__icon" strokeWidth={1.75} aria-hidden />
    </div>
  )
  if (!label) return field
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {field}
    </FormField>
  )
}
