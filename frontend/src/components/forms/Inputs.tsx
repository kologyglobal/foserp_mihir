import { useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { inputClassName } from '../forms/FormField'
import { useFilterBarField } from '../design-system/filterBarContext'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { parseSelectOptions, toSmartSelectOptions } from '../../utils/parseSelectOptions'

/** Layout/width utilities belong on the wrapper so filters sit inline beside search boxes. */
const SELECT_WRAP_CLASS = /^(w-|min-w-|max-w-|shrink-|grow-|basis-|flex-|mt-|mb-|ml-|mr-|m-|self-)/

function partitionSelectClasses(className?: string) {
  if (!className) return { wrap: '', select: '' }
  const wrap: string[] = []
  const select: string[] = []
  for (const token of className.split(/\s+/).filter(Boolean)) {
    if (SELECT_WRAP_CLASS.test(token)) wrap.push(token)
    else select.push(token)
  }
  return { wrap: wrap.join(' '), select: select.join(' ') }
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input className={cn('erp-input', inputClassName(error), className)} {...props} />
  )
}

interface MobileInputProps extends Omit<InputProps, 'type' | 'inputMode' | 'pattern'> {
  /** Max digit length (default 15). */
  maxDigits?: number
}

/**
 * Standard mobile / phone field — accepts digits 0–9 only.
 * Use for every mobile, phone, and contactPhone input in the app.
 */
export function MobileInput({
  className,
  error,
  maxDigits = 15,
  value,
  defaultValue,
  onChange,
  onPaste,
  ...props
}: MobileInputProps) {
  const isControlled = value !== undefined

  function toDigits(raw: string) {
    return raw.replace(/\D/g, '').slice(0, maxDigits)
  }

  function emitDigits(
    e: ChangeEvent<HTMLInputElement>,
    digits: string,
    handler?: React.ChangeEventHandler<HTMLInputElement>,
  ) {
    if (!isControlled) {
      e.target.value = digits
    }
    const next = {
      ...e,
      target: { ...e.target, value: digits },
      currentTarget: { ...e.currentTarget, value: digits },
    } as ChangeEvent<HTMLInputElement>
    handler?.(next)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="tel"
      pattern="[0-9]*"
      maxLength={maxDigits}
      className={cn('erp-input', inputClassName(error), className)}
      value={isControlled ? toDigits(String(value ?? '')) : undefined}
      defaultValue={
        defaultValue !== undefined ? toDigits(String(defaultValue)) : undefined
      }
      onChange={(e) => emitDigits(e, toDigits(e.target.value), onChange)}
      onPaste={(e) => {
        onPaste?.(e)
        if (e.defaultPrevented) return
        e.preventDefault()
        const pasted = e.clipboardData.getData('text')
        const digits = toDigits(pasted)
        const el = e.currentTarget
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const merged = toDigits(el.value.slice(0, start) + digits + el.value.slice(end))
        if (!isControlled) {
          el.value = merged
        }
        const synthetic = {
          ...e,
          target: { ...el, value: merged },
          currentTarget: { ...el, value: merged },
        } as unknown as ChangeEvent<HTMLInputElement>
        onChange?.(synthetic)
      }}
    />
  )
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  error?: boolean
  /** Width/layout on the outer wrapper (e.g. w-40, shrink-0) */
  wrapClassName?: string
  /** Force native `<select>` (e.g. multi-select) */
  native?: boolean
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

function NativeSelect({
  className,
  wrapClassName,
  error,
  children,
  ...props
}: SelectProps) {
  const inFilterBar = useFilterBarField()
  const partitioned = partitionSelectClasses(className)
  const hasWrapWidth = Boolean(wrapClassName ?? partitioned.wrap)
  const resolvedWrap = cn(
    wrapClassName ?? partitioned.wrap,
    !hasWrapWidth && !inFilterBar && 'w-full',
    !hasWrapWidth && inFilterBar && 'w-36 shrink-0',
  )

  return (
    <div className={cn('erp-select-wrap', resolvedWrap)}>
      <select className={cn('erp-input erp-select w-full', inputClassName(error), partitioned.select)} {...props}>
        {children}
      </select>
      <ChevronDown className="erp-select-chevron pointer-events-none h-4 w-4" aria-hidden />
    </div>
  )
}

export function Select({
  className,
  wrapClassName,
  error,
  children,
  native,
  value,
  onChange,
  disabled,
  name,
  multiple,
  ...rest
}: SelectProps) {
  const inFilterBar = useFilterBarField()
  const partitioned = partitionSelectClasses(className)
  const parsed = useMemo(() => parseSelectOptions(children), [children])
  const hasWrapWidth = Boolean(wrapClassName ?? partitioned.wrap)
  const resolvedWrap = cn(
    wrapClassName ?? partitioned.wrap,
    !hasWrapWidth && !inFilterBar && 'w-full',
    !hasWrapWidth && inFilterBar && 'w-36 shrink-0',
  )

  const emptyOption = parsed.find((o) => o.value === '')
  const smartOptions = useMemo(() => toSmartSelectOptions(parsed), [parsed])
  const stringValue = value === undefined || value === null ? '' : String(value)
  const smartClassName = partitioned.select.replace(/\berp-input\b/g, '').trim()

  if (native || multiple || parsed.length === 0) {
    return (
      <NativeSelect
        className={className}
        wrapClassName={wrapClassName}
        error={error}
        value={value}
        onChange={onChange}
        disabled={disabled}
        name={name}
        multiple={multiple}
        {...rest}
      >
        {children}
      </NativeSelect>
    )
  }

  return (
    <div className={cn('erp-select-wrap erp-select-wrap--smart', resolvedWrap)}>
      <ErpSmartSelect
        options={smartOptions}
        value={stringValue}
        onChange={(next) => {
          onChange?.({
            target: { value: next, name: name ?? '' },
          } as ChangeEvent<HTMLSelectElement>)
        }}
        placeholder={emptyOption?.label ?? 'Click to browse or type to search…'}
        allowEmpty={Boolean(emptyOption)}
        disabled={disabled}
        compact={inFilterBar}
        error={error}
        appearance={inFilterBar ? 'combo' : 'dropdown'}
        className={smartClassName}
        emptyMessage="No matches — try another keyword"
      />
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn('erp-input', inputClassName(error), 'min-h-[80px] resize-y py-2', className)}
      {...props}
    />
  )
}

interface CurrencyInputProps extends Omit<InputProps, 'type'> {
  currency?: string
}

export function CurrencyInput({ currency = '₹', className, error, ...props }: CurrencyInputProps) {
  return (
    <div className={cn('erp-input-prefix', error && 'erp-input-prefix-error')}>
      <span className="erp-input-prefix-symbol">{currency}</span>
      <input type="text" inputMode="decimal" className={cn('erp-input erp-input-with-prefix', inputClassName(error), className)} {...props} />
    </div>
  )
}

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  indeterminate?: boolean
}

export function Checkbox({ label, className, indeterminate, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  return (
    <label className={cn('erp-checkbox-label', className)}>
      <input ref={ref} type="checkbox" className="erp-checkbox-input" {...props} />
      <span className="erp-checkbox-box" aria-hidden />
      {label && <span className="erp-checkbox-text">{label}</span>}
    </label>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <label className={cn('erp-switch-label', disabled && 'opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('erp-switch', checked && 'erp-switch-on')}
      >
        <span className="erp-switch-thumb" />
      </button>
      {label && <span className="erp-switch-text">{label}</span>}
    </label>
  )
}
