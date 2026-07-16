import { type FocusEventHandler } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onFocus?: FocusEventHandler<HTMLInputElement>
  onBlur?: FocusEventHandler<HTMLInputElement>
  autoComplete?: string
  autoFocus?: boolean
  'aria-label'?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  inputClassName,
  size = 'md',
  disabled,
  onFocus,
  onBlur,
  autoComplete,
  autoFocus,
  'aria-label': ariaLabel,
}: SearchInputProps) {
  return (
    <div
      className={cn(
        'erp-search-field',
        size === 'sm' && 'erp-search-field--sm',
        size === 'md' && 'erp-search-field--md',
        size === 'lg' && 'erp-search-field--lg',
        className,
      )}
    >
      <Search className="erp-search-field__icon" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        className={cn('erp-input erp-search-field__input', inputClassName)}
      />
    </div>
  )
}
