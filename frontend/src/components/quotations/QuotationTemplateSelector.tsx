import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, Check, ChevronDown, Search } from 'lucide-react'
import { Select } from '../forms/Inputs'
import { cn } from '../../utils/cn'
import {
  countQuotationTemplateSections,
  quotationTemplateSectionTitles,
  quotationTemplateSummaryText,
} from '../../utils/quotationTemplates'

export type QuotationTemplateOption = {
  id: string
  templateName: string
  productFamily: string
  code?: string | null
  defaultTerms?: string | null
  sections?: Array<{
    title?: string
    content?: string
    sectionType?: string
    sequenceNo?: number
  }>
}

interface QuotationTemplateSelectorProps {
  templates: QuotationTemplateOption[]
  value: string
  onChange: (templateId: string) => void
  /**
   * `rich` = Dynamics-style searchable picker with shared section preview (quotation new).
   * `select` = compact native select (modals / tight layouts).
   */
  variant?: 'rich' | 'select' | 'cards'
  /** Override label; pass empty string to hide. */
  label?: string
  disabled?: boolean
}

function buildSearchText(t: QuotationTemplateOption): string {
  const titles = quotationTemplateSectionTitles(t, 12).join(' ')
  const summary = quotationTemplateSummaryText(t) ?? ''
  return [t.templateName, t.productFamily, t.code, summary, titles].filter(Boolean).join(' ').toLowerCase()
}

function metaLine(t: QuotationTemplateOption): string {
  const n = countQuotationTemplateSections(t)
  return n > 0 ? `${t.productFamily} · ${n} sections` : t.productFamily
}

/** One-line blurb for list rows; omit when it only restates the template name. */
function rowSummary(t: QuotationTemplateOption): string | null {
  const summary = quotationTemplateSummaryText(t)
  if (!summary) return null
  const name = t.templateName.trim().toLowerCase()
  if (!name) return summary
  const normalized = summary.trim().toLowerCase()
  if (normalized === name || normalized.startsWith(`${name} —`) || normalized.startsWith(`${name} -`)) {
    return null
  }
  return summary
}

export function QuotationTemplateSelector({
  templates,
  value,
  onChange,
  variant = 'rich',
  label = 'Quotation template',
  disabled,
}: QuotationTemplateSelectorProps) {
  const usable = useMemo(
    () => (Array.isArray(templates) ? templates : []).filter((t) => t?.id),
    [templates],
  )
  const useSelect = variant === 'select'

  if (useSelect) {
    return (
      <label className="block">
        {label ? <span className="erp-form-label mb-1.5 block">{label}</span> : null}
        <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {usable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.templateName} ({t.productFamily})
            </option>
          ))}
        </Select>
      </label>
    )
  }

  return (
    <RichQuotationTemplatePicker
      templates={usable}
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
    />
  )
}

function RichQuotationTemplatePicker({
  templates,
  value,
  onChange,
  label,
  disabled,
}: {
  templates: QuotationTemplateOption[]
  value: string
  onChange: (templateId: string) => void
  label: string
  disabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})

  const selected = useMemo(
    () => (Array.isArray(templates) ? templates : []).find((t) => t.id === value),
    [templates, value],
  )

  const filtered = useMemo(() => {
    const list = Array.isArray(templates) ? templates : []
    const q = filterQuery.trim().toLowerCase()
    if (!q) return list
    const tokens = q.split(/\s+/).filter(Boolean)
    return list.filter((t) => {
      const hay = buildSearchText(t)
      return tokens.every((tok) => hay.includes(tok))
    })
  }, [templates, filterQuery])

  const highlighted = filtered[highlightIndex] ?? filtered[0]
  const previewTitles = highlighted ? quotationTemplateSectionTitles(highlighted, 10) : []
  const previewTotal = highlighted ? countQuotationTemplateSections(highlighted) : 0

  const positionDropdown = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 440), window.innerWidth - 16)
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const vhCap = Math.round(window.innerHeight * 0.45)
    const maxHeight = Math.min(vhCap, Math.max(220, spaceBelow))
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left,
      width,
      maxHeight,
      zIndex: 10050,
    })
  }, [])

  const openList = useCallback(() => {
    if (disabled) return
    const list = Array.isArray(templates) ? templates : []
    const idx = list.findIndex((t) => t.id === value)
    setFilterQuery('')
    setHighlightIndex(idx >= 0 ? idx : 0)
    setOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [disabled, templates, value])

  useEffect(() => {
    if (!open) {
      setFilterQuery('')
      setHighlightIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    positionDropdown()
    const onReflow = () => positionDropdown()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, positionDropdown, filtered.length])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    if (!open) return
    const el = dropdownRef.current?.querySelector<HTMLElement>(
      '.crm-template-picker__option--highlight',
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open, filtered.length])

  function selectTemplate(id: string) {
    onChange(id)
    setFilterQuery('')
    setOpen(false)
    anchorRef.current?.focus()
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openList()
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Home' && filtered.length > 0) {
      e.preventDefault()
      setHighlightIndex(0)
      return
    }
    if (e.key === 'End' && filtered.length > 0) {
      e.preventDefault()
      setHighlightIndex(filtered.length - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlightIndex]
      if (opt) selectTemplate(opt.id)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      anchorRef.current?.focus()
    }
  }

  const selectedTitles = selected ? quotationTemplateSectionTitles(selected, 4) : []
  const selectedSectionCount = selected ? countQuotationTemplateSections(selected) : 0

  return (
    <div ref={wrapRef} className="crm-template-picker">
      {label ? <span className="erp-form-label mb-1.5 block">{label}</span> : null}

      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        className={cn(
          'crm-template-picker__trigger',
          open && 'crm-template-picker__trigger--open',
          selected && 'crm-template-picker__trigger--selected',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || 'Quotation template'}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <Bookmark className="crm-template-picker__trigger-icon" aria-hidden />
        <span className="crm-template-picker__trigger-body">
          {selected ? (
            <>
              <span className="crm-template-picker__trigger-title-row">
                <span className="crm-template-picker__trigger-title">{selected.templateName}</span>
                <span className="crm-template-picker__trigger-meta">{metaLine(selected)}</span>
              </span>
              {selectedTitles.length > 0 ? (
                <span className="crm-template-picker__preview" aria-hidden>
                  {selectedTitles.map((title) => (
                    <span key={title} className="crm-template-picker__preview-chip">
                      {title}
                    </span>
                  ))}
                  {selectedSectionCount > selectedTitles.length ? (
                    <span className="crm-template-picker__preview-more">
                      +{selectedSectionCount - selectedTitles.length}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : (
            <span className="crm-template-picker__trigger-placeholder">Select a quotation template…</span>
          )}
        </span>
        <ChevronDown
          className={cn('crm-template-picker__chevron', open && 'crm-template-picker__chevron--open')}
          aria-hidden
        />
      </button>

      {open && !disabled
        ? createPortal(
            <div
              ref={dropdownRef}
              className="crm-template-picker__dropdown erp-dropdown-panel"
              style={dropdownStyle}
              role="listbox"
              aria-label="Quotation templates"
            >
              <div className="crm-template-picker__search">
                <Search className="crm-template-picker__search-icon" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  className="crm-template-picker__search-input"
                  value={filterQuery}
                  placeholder="Search by name, family, or section…"
                  autoComplete="off"
                  onChange={(e) => {
                    setFilterQuery(e.target.value)
                    setHighlightIndex(0)
                  }}
                  onKeyDown={onSearchKeyDown}
                />
              </div>

              {filtered.length === 0 ? (
                <p className="crm-template-picker__empty">No matching templates.</p>
              ) : (
                <>
                  <p className="crm-template-picker__hint">
                    {filtered.length} template{filtered.length === 1 ? '' : 's'}
                    {filterQuery.trim() ? ` matching “${filterQuery.trim()}”` : ''}
                  </p>
                  <ul className="crm-template-picker__list">
                    {filtered.map((template, index) => {
                      const isSelected = template.id === value
                      const isHighlight = index === highlightIndex
                      const summary = rowSummary(template)

                      return (
                        <li key={template.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              'crm-template-picker__option',
                              isSelected && 'crm-template-picker__option--selected',
                              isHighlight && 'crm-template-picker__option--highlight',
                            )}
                            onMouseEnter={() => setHighlightIndex(index)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectTemplate(template.id)}
                          >
                            <Bookmark className="crm-template-picker__option-icon" aria-hidden />
                            <span className="crm-template-picker__option-copy">
                              <span className="crm-template-picker__option-title-row">
                                <span className="crm-template-picker__option-title">{template.templateName}</span>
                                {isSelected ? (
                                  <Check className="crm-template-picker__check-icon" aria-hidden />
                                ) : null}
                              </span>
                              <span className="crm-template-picker__option-meta">{metaLine(template)}</span>
                              {summary ? (
                                <span className="crm-template-picker__option-summary">{summary}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  {highlighted && previewTitles.length > 0 ? (
                    <div className="crm-template-picker__panel" aria-live="polite">
                      <span className="crm-template-picker__panel-label">
                        Sections · {previewTotal}
                      </span>
                      <div className="crm-template-picker__panel-chips">
                        {previewTitles.map((title) => (
                          <span key={`${highlighted.id}-${title}`} className="crm-template-picker__preview-chip">
                            {title}
                          </span>
                        ))}
                        {previewTotal > previewTitles.length ? (
                          <span className="crm-template-picker__preview-more">
                            +{previewTotal - previewTitles.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
