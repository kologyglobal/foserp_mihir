import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'
import { formatCurrency, parseCurrencyInput } from '../../utils/formatters/currency'

interface FormattedCurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number
  onValueChange: (value: number) => void
}

/**
 * Edit: plain numeric entry. Blur / display: Indian INR (₹9,87,877.00).
 * Parent still receives a number so calculations stay numeric.
 */
export function FormattedCurrencyInput({
  value,
  onValueChange,
  className,
  onFocus,
  onBlur,
  ...props
}: FormattedCurrencyInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!focused) setDraft(value === 0 ? '' : String(value))
  }, [value, focused])

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      className={cn(className)}
      value={focused ? draft : formatCurrency(value)}
      onFocus={(e) => {
        setFocused(true)
        setDraft(value === 0 ? '' : String(value))
        onFocus?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        onValueChange(parseCurrencyInput(next))
      }}
      onBlur={(e) => {
        const parsed = parseCurrencyInput(draft)
        onValueChange(parsed)
        setFocused(false)
        onBlur?.(e)
      }}
    />
  )
}
