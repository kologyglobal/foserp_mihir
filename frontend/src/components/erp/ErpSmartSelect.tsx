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

/** Dedicated body portal so table stacking contexts cannot punch through the menu. */
const PORTAL_ROOT_ID = 'erp-portal-root'
const PORTAL_STYLE_ID = 'erp-smart-select-portal-style'

function ensurePortalStyles() {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(PORTAL_STYLE_ID)
  if (existing) existing.remove()
  const style = document.createElement('style')
  style.id = PORTAL_STYLE_ID
  // Last-in head style beats almost everything without fighting cascade layers.
  style.textContent = `
#erp-portal-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  overflow: visible;
  z-index: 2147483000;
  pointer-events: none;
}
#erp-portal-root .erp-smart-select__dropdown,
#erp-portal-root .erp-smart-select__dropdown--portal {
  pointer-events: auto !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  isolation: isolate !important;
  color: #0f172a !important;
  animation: none !important;
  box-shadow: 0 18px 48px rgba(15,23,42,0.22), 0 4px 14px rgba(15,23,42,0.12) !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 10px !important;
}
#erp-portal-root .erp-smart-select__dropdown *,
#erp-portal-root .erp-smart-select__dropdown--portal * {
  opacity: 1 !important;
}
#erp-portal-root .erp-smart-select__list,
#erp-portal-root .erp-smart-select__empty,
#erp-portal-root [role="option"] {
  background: #ffffff !important;
  background-color: #ffffff !important;
  color: #0f172a !important;
}
#erp-portal-root [role="option"].erp-smart-select__option--highlight,
#erp-portal-root [role="option"].erp-smart-select__option--selected,
#erp-portal-root [role="option"]:hover {
  background: #e8f1fb !important;
  background-color: #e8f1fb !important;
}
#erp-portal-root .erp-smart-select__hint {
  background: #f8fafc !important;
  background-color: #f8fafc !important;
}
#erp-portal-root .erp-smart-select__scrim {
  pointer-events: none !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
}
`
  document.head.appendChild(style)
}

function getPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('ErpSmartSelect portal requires document')
  }
  ensurePortalStyles()
  let root = document.getElementById(PORTAL_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PORTAL_ROOT_ID
    root.setAttribute('data-erp-portal', 'true')
    document.body.appendChild(root)
  }
  // Always re-assert mount-node layout (HMR / old full-screen fixed portal would keep bleeding).
  root.style.cssText =
    'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483000;pointer-events:none;'
  return root
}

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

/** Always opaque white panel — never theme tokens / animation / CSS cascade. */
const SOLID_PANEL: CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: 'none',
  opacity: 1,
  mixBlendMode: 'normal',
  colorScheme: 'light',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  boxShadow: '0 18px 48px rgba(15, 23, 42, 0.22), 0 4px 14px rgba(15, 23, 42, 0.12)',
  overflowX: 'hidden',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  pointerEvents: 'auto',
  zIndex: 2147483000,
  // Force a dedicated compositor layer so underlying table cannot "bleed" through.
  transform: 'translateZ(0)',
  WebkitBackfaceVisibility: 'hidden',
  backfaceVisibility: 'hidden',
  isolation: 'isolate',
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
      ...SOLID_PANEL,
    }
  }

  return {
    position: 'fixed',
    top: 'auto',
    bottom: window.innerHeight - rect.top + gap,
    left,
    width,
    maxHeight,
    ...SOLID_PANEL,
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

  function selectOption(opt: ErpSmartSelectOption<T>, options?: { keepFocus?: boolean }) {
    onChange(opt.value)
    setFilterQuery('')
    setOpen(false)
    // Tab must keep focus so the browser can move to the next control.
    if (!options?.keepFocus) {
      inputRef.current?.blur()
    }
  }

  /** Commit highlighted / typed filter match on blur or Tab (keyboard + mouse-away). */
  function commitPendingSelection(options?: { keepFocus?: boolean }) {
    if (disabled) return false
    const q = filterQuery.trim().toLowerCase()
    if (open && filtered[highlightIndex]) {
      selectOption(filtered[highlightIndex], options)
      return true
    }
    if (q.length > 0) {
      const exact = filtered.find(
        (o) =>
          o.label.toLowerCase() === q ||
          String(o.value).toLowerCase() === q ||
          (o.searchText ?? '').toLowerCase() === q,
      )
      if (exact) {
        selectOption(exact, options)
        return true
      }
      const prefixMatches = filtered.filter(
        (o) =>
          o.label.toLowerCase().startsWith(q) ||
          (o.searchText ?? '').toLowerCase().startsWith(q),
      )
      if (prefixMatches.length === 1) {
        selectOption(prefixMatches[0]!, options)
        return true
      }
    }
    return false
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
    // Commit the highlighted row on Tab so keyboard users update form state
    // (UOM / ERP smart selects / long Selects). Do not preventDefault — focus moves on.
    if (e.key === 'Tab') {
      if (!commitPendingSelection({ keepFocus: true })) {
        setOpen(false)
        setFilterQuery('')
      }
    }
  }

  const dropdownNode =
    open && dropdownStyle ? (
      <div
        ref={dropdownRef}
        className="erp-smart-select__dropdown erp-smart-select__dropdown--portal"
        style={dropdownStyle}
        role="listbox"
      >
        {/* Absolute solid sheet — belt-and-suspenders if any child is transparent */}
        <div
          aria-hidden
          className="erp-smart-select__scrim"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundColor: '#ffffff',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, backgroundColor: '#ffffff' }}>
          {filtered.length === 0 ? (
            <p
              className="erp-smart-select__empty"
              style={{
                margin: 0,
                padding: '12px 14px',
                fontSize: 12.5,
                color: '#64748b',
                backgroundColor: '#ffffff',
              }}
            >
              {emptyMessage}
            </p>
          ) : (
            <>
              <p
                className="erp-smart-select__hint"
                style={{
                  margin: 0,
                  padding: '6px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#64748b',
                  borderBottom: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                {filtered.length} option{filtered.length === 1 ? '' : 's'}
                {filterQuery.trim() ? ` matching “${filterQuery.trim()}”` : ''}
              </p>
              <ul
                className="erp-smart-select__list"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 4,
                  backgroundColor: '#ffffff',
                }}
              >
                {filtered.map((opt, index) => {
                  const rich = Boolean(opt.subtitle || opt.trailing || opt.badge)
                  const active = index === highlightIndex || value === opt.value
                  return (
                    <li key={opt.value} style={{ listStyle: 'none', backgroundColor: '#ffffff' }}>
                      {/* div+role avoids button preflight transparent backgrounds */}
                      <div
                        role="option"
                        aria-selected={value === opt.value}
                        tabIndex={-1}
                        className={cn(
                          'erp-smart-select__option',
                          rich && 'erp-smart-select__option--rich',
                          value === opt.value && 'erp-smart-select__option--selected',
                          index === highlightIndex && 'erp-smart-select__option--highlight',
                        )}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: rich ? 4 : 2,
                          width: '100%',
                          padding: rich ? '8px 10px' : '6px 10px',
                          border: 0,
                          borderRadius: 6,
                          backgroundColor: active ? '#e8f1fb' : '#ffffff',
                          color: '#0f172a',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          boxShadow: value === opt.value ? 'inset 2px 0 0 #0078d4' : undefined,
                        }}
                        onMouseEnter={() => setHighlightIndex(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectOption(opt)}
                      >
                        <span
                          className="erp-smart-select__option-head"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            width: '100%',
                          }}
                        >
                          <span
                            className="erp-smart-select__option-label"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0f172a',
                              lineHeight: 1.35,
                            }}
                          >
                            {opt.label}
                          </span>
                          <span
                            className="erp-smart-select__option-end"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                          >
                            {opt.trailing ? (
                              <span
                                className="erp-smart-select__option-trailing"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#0078d4',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {opt.trailing}
                              </span>
                            ) : null}
                            {value === opt.value ? (
                              <Check
                                className="erp-smart-select__option-check"
                                strokeWidth={2.5}
                                aria-hidden
                                style={{ width: 15, height: 15, color: '#0078d4', flexShrink: 0 }}
                              />
                            ) : null}
                          </span>
                        </span>
                        {opt.subtitle ? (
                          <span
                            className="erp-smart-select__option-subtitle"
                            style={{
                              fontSize: 11.5,
                              fontWeight: 500,
                              lineHeight: 1.35,
                              color: '#4b5563',
                            }}
                          >
                            {opt.subtitle}
                          </span>
                        ) : opt.meta ? (
                          <span
                            className="erp-smart-select__option-meta"
                            style={{
                              fontSize: 11,
                              fontWeight: 400,
                              lineHeight: 1.35,
                              color: '#64748b',
                            }}
                          >
                            {opt.meta}
                          </span>
                        ) : null}
                        {opt.badge ? (
                          <span
                            className="erp-smart-select__option-badge"
                            style={{
                              display: 'inline-flex',
                              marginTop: 2,
                              padding: '2px 6px',
                              borderRadius: 999,
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              textTransform: 'uppercase',
                              color: '#64748b',
                            }}
                          >
                            {opt.badge}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    ) : null

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
              commitPendingSelection()
              setOpen(false)
              setFilterQuery('')
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

      {dropdownNode ? createPortal(dropdownNode, getPortalRoot()) : null}
    </div>
  )
}
