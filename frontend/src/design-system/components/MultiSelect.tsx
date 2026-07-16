import { cn } from '../../utils/cn'
import { Select } from '../../components/forms/Inputs'

export interface MultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  options: { value: string; label: string }[]
  className?: string
  placeholder?: string
}

/** Multi-select using native select[multiple] — consistent ERP styling */
export function MultiSelect({ values, onChange, options, className, placeholder }: MultiSelectProps) {
  return (
    <Select
      multiple
      className={cn('min-h-[88px]', className)}
      value={values}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
        onChange(selected)
      }}
      aria-label={placeholder ?? 'Multi select'}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  )
}
