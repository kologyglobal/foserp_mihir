import { cn } from '../../utils/cn'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="erp-form-label">
        {label}
        {required && <span className="ml-0.5 text-erp-danger-solid">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] text-erp-muted">{hint}</p>}
      {error && <p className="text-[12px] font-medium text-erp-danger-fg">{error}</p>}
    </div>
  )
}

export function inputClassName(error?: boolean) {
  return cn(
    error && 'border-erp-danger-solid focus:border-erp-danger-solid focus:ring-erp-danger-solid/15',
  )
}
