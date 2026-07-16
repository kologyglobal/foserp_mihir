import { Input } from '../../components/forms/Inputs'
import { FormField } from '../../components/forms/FormField'

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

export function DatePicker({ label, error, hint, required, className, ...props }: DatePickerProps) {
  const field = <Input type="date" error={Boolean(error)} className={className} {...props} />
  if (!label) return field
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {field}
    </FormField>
  )
}
