import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { inputClassName } from '../forms/FormField'
import { useFilterBarField } from '../design-system/filterBarContext'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { parseSelectOptions, toSmartSelectOptions } from '../../utils/parseSelectOptions'
import { resolveSelectPlaceholder, SELECT_PLACEHOLDER } from './selectStandards'
import { isPartialDecimalText, parseDecimalInput } from '../../utils/parseDecimalInput'

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

interface DecimalInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  value: number
  onChange: (value: number) => void
  error?: boolean
  /** Focus on a zero value starts blank so typing "29" does not become "029". Default true. */
  clearZeroOnFocus?: boolean
  /** Select existing text on focus when non-zero. Default true. */
  selectAllOnFocus?: boolean
}

function normalizeDecimalDraft(raw: string): string {
  if (raw === '' || raw.endsWith('.') || raw === '-' || raw === '-.') return raw
  if (!isPartialDecimalText(raw)) return raw
  return String(parseDecimalInput(raw))
}

/**
 * Quantity field: native number spinners + draft while focused.
 * Strips leading zeros (029 → 29) and avoids snapping empty input back to 0 mid-typing.
 */
export function DecimalInput({
  className,
  error,
  value,
  onChange,
  clearZeroOnFocus = true,
  selectAllOnFocus = true,
  min,
  max,
  step = 'any',
  disabled,
  onFocus,
  onBlur,
  ...props
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const clamp = (n: number) => {
    let out = n
    if (min !== undefined) out = Math.max(Number(min), out)
    if (max !== undefined) out = Math.min(Number(max), out)
    return out
  }

  const commit = (raw: string) => {
    onChange(clamp(parseDecimalInput(raw)))
  }

  const applyDraft = (raw: string) => {
    const normalized = normalizeDecimalDraft(raw)
    setDraft(normalized)
    commit(normalized)
  }

  const displayValue = focused
    ? draft
    : Number.isFinite(value)
      ? value
      : 0

  return (
    <input
      {...props}
      type="number"
      step={step}
      min={min}
      max={max}
      autoComplete="off"
      disabled={disabled}
      className={cn('erp-input', inputClassName(error), className)}
      value={focused && draft === '' ? '' : displayValue}
      onFocus={(e) => {
        setFocused(true)
        const start =
          clearZeroOnFocus && value === 0 ? '' : String(Number.isFinite(value) ? value : 0)
        setDraft(start)
        onFocus?.(e)
        if (selectAllOnFocus && start !== '') {
          requestAnimationFrame(() => e.target.select())
        }
      }}
      onChange={(e) => {
        const next = e.target.value
        if (next === '') {
          setDraft('')
          commit('')
          return
        }
        if (!isPartialDecimalText(next)) return
        applyDraft(next)
      }}
      onBlur={(e) => {
        applyDraft(draft)
        setFocused(false)
        onBlur?.(e)
      }}
    />
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
  /** Force native (`true`) or smart (`false`) rendering. Omit for automatic selection. */
  native?: boolean
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

function NativeSelect({
  className,
  wrapClassName,
  error,
  children,
  ensurePlaceholder,
  placeholderLabel = SELECT_PLACEHOLDER,
  ...props
}: SelectProps & { ensurePlaceholder?: boolean; placeholderLabel?: string }) {
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
        {ensurePlaceholder ? <option value="">{placeholderLabel}</option> : null}
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
  const parsedRaw = useMemo(() => parseSelectOptions(children), [children])
  const hasEmpty = parsedRaw.some((o) => o.value === '')
  /** Forms without an empty option still get a closed “— Select —” state. */
  const injectEmpty = !hasEmpty && !inFilterBar && !multiple && parsedRaw.length > 0
  const parsed = useMemo(() => {
    if (!injectEmpty) return parsedRaw
    return [{ value: '', label: SELECT_PLACEHOLDER }, ...parsedRaw]
  }, [injectEmpty, parsedRaw])

  const realOptionCount = useMemo(
    () => parsedRaw.filter((o) => o.value !== '').length,
    [parsedRaw],
  )
  /** Short lists (Yes/No, priority, type) use native — no search chrome or portal flicker. */
  const preferNative =
    multiple || parsedRaw.length === 0 || (native ?? realOptionCount <= 8)

  const hasWrapWidth = Boolean(wrapClassName ?? partitioned.wrap)
  const resolvedWrap = cn(
    wrapClassName ?? partitioned.wrap,
    !hasWrapWidth && !inFilterBar && 'w-full',
    !hasWrapWidth && inFilterBar && 'w-36 shrink-0',
  )

  const emptyOption = parsed.find((o) => o.value === '')
  /** Open list = real options only; placeholder stays on the closed control. */
  const smartOptions = useMemo(
    () => toSmartSelectOptions(parsed).filter((o) => o.value !== ''),
    [parsed],
  )
  const stringValue = value === undefined || value === null ? '' : String(value)
  const smartClassName = partitioned.select.replace(/\berp-input\b/g, '').trim()
  const placeholder = resolveSelectPlaceholder(emptyOption?.label, { inFilterBar })

  if (preferNative) {
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
        ensurePlaceholder={injectEmpty}
        placeholderLabel={placeholder}
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
        placeholder={placeholder}
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
