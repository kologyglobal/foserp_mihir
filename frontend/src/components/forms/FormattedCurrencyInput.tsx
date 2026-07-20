import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'
import { formatCurrency, parseCurrencyInput } from '../../utils/formatters/currency'

interface FormattedCurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number
  onValueChange: (value: number) => void
}

/** Digits and at most one decimal point — no letters or symbols while editing. */
function sanitizeNumericDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
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
      pattern="[0-9]*[.]?[0-9]*"
      autoComplete="off"
      className={cn(className)}
      value={focused ? draft : formatCurrency(value)}
      onFocus={(e) => {
        setFocused(true)
        setDraft(value === 0 ? '' : String(value))
        onFocus?.(e)
      }}
      onChange={(e) => {
        const next = sanitizeNumericDraft(e.target.value)
        setDraft(next)
        onValueChange(parseCurrencyInput(next))
      }}
      onKeyDown={(e) => {
        // Block scientific notation / sign keys that slip past text inputs
        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
          e.preventDefault()
        }
        props.onKeyDown?.(e)
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
