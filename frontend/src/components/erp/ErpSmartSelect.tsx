import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronDown, X, Check } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface ErpSmartSelectOption<T = string> {
  value: T
  label: string
  searchText: string
  /** Legacy secondary line — prefer `subtitle` + `trailing` for richer rows */
  meta?: ReactNode
  /** Company / context line under the primary label */
  subtitle?: string
  /** Right-aligned amount or status emphasis */
  trailing?: ReactNode
  /** Compact status / tag under the subtitle */
  badge?: string
}

interface ErpSmartSelectProps<T = string> {
  options: ErpSmartSelectOption<T>[]
  value: T | ''
  onChange: (value: T | '') => void
  placeholder?: string
  disabled?: boolean
  className?: string
  emptyMessage?: string
  /** Allow clearing back to empty value (filter "All" options) */
  allowEmpty?: boolean
  /** Compact height for filter bars */
  compact?: boolean
  error?: boolean
  /** dropdown = chevron-only when closed (forms); combo = always show search icon */
  appearance?: 'combo' | 'dropdown'
  /** Minimum dropdown width in px (useful for rich option rows) */
  dropdownMinWidth?: number
  /** Fired when focus leaves the control (Tab / click away). */
  onBlur?: () => void
  /**
   * When the current value is missing from `options`, resolve a human-readable label.
   * Never pass through raw UUIDs — return undefined to show the placeholder instead.
   */
  resolveOrphanLabel?: (value: T) => string | undefined
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Closed-control label when value is not in options — never title-case a UUID. */
export function formatSmartSelectOrphanLabel(
  value: string,
  resolve?: (value: string) => string | undefined,
): string | undefined {
  const raw = String(value).trim()
  if (!raw) return undefined
  const resolved = resolve?.(raw)?.trim()
  if (resolved) return resolved
  if (UUID_RE.test(raw) || /^[0-9a-f]{32}$/i.test(raw)) return undefined
  // Stable codes like MAIN_WH / chhapi-plant → readable words; leave free text as-is.
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(raw)) {
    return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return raw
}

function matchQuery(searchText: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return q.split(/\s+/).every((token) => searchText.includes(token))
}

function computeDropdownStyle(
  anchor: HTMLElement | null,
  dropdownMinWidth: number,
): CSSProperties | null {
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null

  const width = Math.max(rect.width, dropdownMinWidth)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  const gap = 4
  const pad = 8
  const spaceBelow = window.innerHeight - rect.bottom - pad
  const spaceAbove = rect.top - pad
  const preferredMax = 280
  const openBelow = spaceBelow >= Math.min(preferredMax, 160) || spaceBelow >= spaceAbove
  const available = Math.max(120, openBelow ? spaceBelow : spaceAbove)
  const maxHeight = Math.min(preferredMax, available - gap)

  if (openBelow) {
    return {
      position: 'fixed',
      top: rect.bottom + gap,
      bottom: 'auto',
      left,
      width,
      maxHeight,
      zIndex: 10050,
    }
  }

  return {
    position: 'fixed',
    top: 'auto',
    bottom: window.innerHeight - rect.top + gap,
    left,
    width,
    maxHeight,
    zIndex: 10050,
  }
}

export function ErpSmartSelect<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = '— Select —',
  disabled,
  className,
  emptyMessage = 'No matches found',
  allowEmpty = false,
  compact = false,
  error = false,
  appearance = 'combo',
  dropdownMinWidth = 280,
  onBlur,
  resolveOrphanLabel,
}: ErpSmartSelectProps<T>) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardNavRef = useRef(false)
  const [open, setOpen] = useState(false)
  /** Filter text only — empty on open so the full list is visible without clearing the field */
  const [filterQuery, setFilterQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null)

  const selected = options.find((o) => o.value === value)
  const orphanLabel =
    value && !selected
      ? formatSmartSelectOrphanLabel(String(value), resolveOrphanLabel as ((v: string) => string | undefined) | undefined)
      : undefined

  const filtered = useMemo(() => {
    return options.filter((o) => matchQuery(o.searchText, filterQuery))
  }, [options, filterQuery])

  const displayValue = open
    ? (filterQuery !== '' ? filterQuery : (selected?.label ?? orphanLabel ?? ''))
    : (selected
      ? (selected.subtitle
        ? `${selected.label} · ${selected.subtitle.split(' · ')[0]}`
        : selected.label)
      : (orphanLabel ?? ''))

  const positionDropdown = useCallback(() => {
    const next = computeDropdownStyle(anchorRef.current, dropdownMinWidth)
    if (next) setDropdownStyle(next)
  }, [dropdownMinWidth])

  const openList = useCallback((resetFilter = true) => {
    if (disabled) return

    const selectedIndex = options.findIndex((o) => o.value === value)
    if (resetFilter) setFilterQuery('')
    setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0)

    // Position before paint so the portal renders on the same open frame (no flicker).
    const style = computeDropdownStyle(anchorRef.current, dropdownMinWidth)
    if (style) setDropdownStyle(style)

    setOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      if (resetFilter && selected?.label && appearance === 'combo') {
        inputRef.current?.select()
      }
    })
  }, [disabled, options, value, selected?.label, appearance, dropdownMinWidth])

  useEffect(() => {
    if (!open) {
      setFilterQuery('')
      setHighlightIndex(0)
      setDropdownStyle(null)
      keyboardNavRef.current = false
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    positionDropdown()
    const raf = requestAnimationFrame(() => positionDropdown())
    window.addEventListener('scroll', positionDropdown, true)
    window.addEventListener('resize', positionDropdown)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', positionDropdown, true)
      window.removeEventListener('resize', positionDropdown)
    }
  }, [open, positionDropdown, filtered.length])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Only scroll the highlighted option into view after keyboard navigation — not on open/mouse.
  useEffect(() => {
    if (!open || !keyboardNavRef.current) return
    keyboardNavRef.current = false
    const el = dropdownRef.current?.querySelector<HTMLElement>(
      '.erp-smart-select__option--highlight',
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  function selectOption(opt: ErpSmartSelectOption<T>) {
    onChange(opt.value)
    setFilterQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('' as T | '')
    setFilterQuery('')
    setOpen(false)
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        openList(true)
      } else {
        keyboardNavRef.current = true
        setHighlightIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        openList(true)
      } else {
        keyboardNavRef.current = true
        setHighlightIndex((i) => Math.max(i - 1, 0))
      }
      return
    }
    if (e.key === 'Home' && open && filtered.length > 0) {
      e.preventDefault()
      keyboardNavRef.current = true
      setHighlightIndex(0)
      return
    }
    if (e.key === 'End' && open && filtered.length > 0) {
      e.preventDefault()
      keyboardNavRef.current = true
      setHighlightIndex(filtered.length - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[highlightIndex]) {
        selectOption(filtered[highlightIndex])
      } else {
        openList(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setFilterQuery('')
      setOpen(false)
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={cn(
      'erp-smart-select',
      compact && 'erp-smart-select--compact',
      appearance === 'dropdown' && 'erp-smart-select--dropdown',
      error && 'erp-smart-select--error',
      className,
    )}>
      <div
        ref={anchorRef}
        className={cn(
          'erp-smart-select__anchor',
          disabled && 'erp-smart-select__anchor--disabled',
          open && 'erp-smart-select__anchor--open',
        )}
        onClick={() => {
          if (disabled) return
          // Focus only — open happens once via onFocus (avoids click+focus double reset).
          inputRef.current?.focus()
        }}
      >
        <Search className={cn('erp-smart-select__icon h-3.5 w-3.5', appearance === 'dropdown' && 'erp-smart-select__icon--combo')} aria-hidden />
        <input
          ref={inputRef}
          className="erp-smart-select__input"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          onChange={(e) => {
            setFilterQuery(e.target.value)
            setHighlightIndex(0)
            if (!open) openList(false)
          }}
          onFocus={() => {
            if (disabled) return
            if (!open) openList(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              const active = document.activeElement
              if (anchorRef.current?.contains(active)) return
              if (dropdownRef.current?.contains(active)) return
              setOpen(false)
              onBlur?.()
            }, 0)
          }}
          onKeyDown={onInputKeyDown}
        />
        {allowEmpty && value && !disabled ? (
          <button
            type="button"
            className="erp-smart-select__clear"
            onClick={clearValue}
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <ChevronDown className={cn('erp-smart-select__chevron h-4 w-4', open && 'erp-smart-select__chevron--open')} aria-hidden />
      </div>

      {open && dropdownStyle
        ? createPortal(
        <div ref={dropdownRef} className="erp-smart-select__dropdown" style={dropdownStyle} role="listbox">
          {filtered.length === 0 ? (
            <p className="erp-smart-select__empty">{emptyMessage}</p>
          ) : (
            <>
              <p className="erp-smart-select__hint">
                {filtered.length} option{filtered.length === 1 ? '' : 's'}
                {filterQuery.trim() ? ` matching “${filterQuery.trim()}”` : ''}
              </p>
              <ul className="erp-smart-select__list">
                {filtered.map((opt, index) => {
                  const rich = Boolean(opt.subtitle || opt.trailing || opt.badge)
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === opt.value}
                        className={cn(
                          'erp-smart-select__option',
                          rich && 'erp-smart-select__option--rich',
                          value === opt.value && 'erp-smart-select__option--selected',
                          index === highlightIndex && 'erp-smart-select__option--highlight',
                        )}
                        onMouseEnter={() => setHighlightIndex(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectOption(opt)}
                      >
                        <span className="erp-smart-select__option-head">
                          <span className="erp-smart-select__option-label">{opt.label}</span>
                          <span className="erp-smart-select__option-end">
                            {opt.trailing ? (
                              <span className="erp-smart-select__option-trailing">{opt.trailing}</span>
                            ) : null}
                            {value === opt.value ? (
                              <Check className="erp-smart-select__option-check" strokeWidth={2.5} aria-hidden />
                            ) : null}
                          </span>
                        </span>
                        {opt.subtitle ? (
                          <span className="erp-smart-select__option-subtitle">{opt.subtitle}</span>
                        ) : opt.meta ? (
                          <span className="erp-smart-select__option-meta">{opt.meta}</span>
                        ) : null}
                        {opt.badge ? (
                          <span className="erp-smart-select__option-badge">{opt.badge}</span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>,
        document.body,
      )
        : null}
    </div>
  )
}
