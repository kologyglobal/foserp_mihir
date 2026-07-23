import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronDown, X, Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useItemLookup, type ItemLookupSelection } from '../../hooks/useItemLookup'

export interface ItemLookupSelectProps {
  value: string
  onChange: (selection: ItemLookupSelection | null) => void
  itemType?: string
  itemTypes?: string[]
  activeOnly?: boolean
  disabled?: boolean
  compact?: boolean
  allowEmpty?: boolean
  placeholder?: string
  className?: string
  error?: boolean
}

export function ItemLookupSelect({
  value,
  onChange,
  itemType,
  itemTypes,
  activeOnly = true,
  disabled,
  compact,
  allowEmpty,
  placeholder = 'Search item code or name…',
  className,
  error,
}: ItemLookupSelectProps) {
  const { query, setQuery, options, loading, error: lookupError, selected, totalCount } = useItemLookup({
    itemType,
    itemTypes,
    activeOnly,
    selectedId: value || undefined,
  })

  const anchorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})

  const positionDropdown = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 320)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: Math.max(8, left),
      width,
      zIndex: 10050,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    positionDropdown()
    window.addEventListener('scroll', positionDropdown, true)
    window.addEventListener('resize', positionDropdown)
    return () => {
      window.removeEventListener('scroll', positionDropdown, true)
      window.removeEventListener('resize', positionDropdown)
    }
  }, [open, positionDropdown])

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
    setHighlightIndex((i) => Math.min(i, Math.max(0, options.length - 1)))
  }, [options.length])

  function selectOption(opt: (typeof options)[number]) {
    onChange({
      itemId: opt.itemId,
      itemCode: opt.itemCode,
      itemName: opt.itemName,
      itemType: opt.itemType,
      uomId: opt.uomId,
      uomName: opt.uomName,
    })
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
    setOpen(false)
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlightIndex((i) => Math.min(i + 1, options.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlightIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && options[highlightIndex]) selectOption(options[highlightIndex])
      else setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setQuery('')
      setOpen(false)
    }
  }

  const displayValue = open ? query : (selected?.label ?? '')

  return (
    <div className={cn('erp-smart-select', compact && 'erp-smart-select--compact', error && 'erp-smart-select--error', className)}>
      <div
        ref={anchorRef}
        className={cn('erp-smart-select__anchor', disabled && 'erp-smart-select__anchor--disabled', open && 'erp-smart-select__anchor--open')}
        onClick={() => { if (!disabled) setOpen(true) }}
      >
        <Search className="erp-smart-select__icon h-3.5 w-3.5" aria-hidden />
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
            setQuery(e.target.value)
            if (!open) setOpen(true)
            setHighlightIndex(0)
          }}
          onFocus={() => { if (!disabled && !open) setOpen(true) }}
          onKeyDown={onInputKeyDown}
        />
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-erp-muted" aria-hidden /> : null}
        {allowEmpty && value && !disabled ? (
          <button type="button" className="erp-smart-select__clear" onClick={clearValue} aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <ChevronDown className={cn('erp-smart-select__chevron h-4 w-4', open && 'erp-smart-select__chevron--open')} aria-hidden />
      </div>

      {open && createPortal(
        <div ref={dropdownRef} className="erp-smart-select__dropdown" style={dropdownStyle} role="listbox">
          {lookupError ? (
            <p className="erp-smart-select__empty text-red-600">{lookupError}</p>
          ) : loading && options.length === 0 ? (
            <p className="erp-smart-select__empty">Searching items…</p>
          ) : options.length === 0 ? (
            <p className="erp-smart-select__empty">No items found — try another search</p>
          ) : (
            <>
              <p className="erp-smart-select__hint">
                {totalCount != null && totalCount > options.length
                  ? `Showing ${options.length} of ${totalCount} items`
                  : `${options.length} item${options.length === 1 ? '' : 's'}`}
                {query.trim() ? ` matching “${query.trim()}”` : ''}
                {!query.trim() ? ' — scroll or type to find' : ''}
              </p>
              <ul className="erp-smart-select__list">
                {options.map((opt, index) => (
                  <li key={opt.itemId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === opt.itemId}
                      className={cn(
                        'erp-smart-select__option',
                        value === opt.itemId && 'erp-smart-select__option--selected',
                        index === highlightIndex && 'erp-smart-select__option--highlight',
                        !opt.isActive && 'opacity-70',
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectOption(opt)}
                    >
                      <span className="erp-smart-select__option-label">{opt.label}</span>
                      <span className="erp-smart-select__option-meta text-xs text-erp-muted">
                        {opt.uomName ?? '—'} · {opt.itemType}{!opt.isActive ? ' · Inactive' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
