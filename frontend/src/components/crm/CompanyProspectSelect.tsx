import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Building2, Plus, Search } from 'lucide-react'
import { useMasterStore } from '../../store/masterStore'
import { useActiveCustomers } from '../../hooks/useMasterLists'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import type { QuickCreateResult } from '../../types/quickCreate'
import type { Customer } from '../../types/master'
import {
  findExactCompanyByName,
  findSimilarCompanies,
  searchCompanyProspects,
  type CompanyProspectMatch,
} from '../../utils/companyProspectSearch'
import { ErpButton } from '../erp/ErpButton'
import { QuickCompanyCreateModal } from './QuickCompanyCreateModal'
import { cn } from '../../utils/cn'

export interface CompanyProspectValue {
  customerId: string | null
  prospectName: string
}

interface CompanyProspectSelectProps {
  value: CompanyProspectValue
  onChange: (value: CompanyProspectValue) => void
  onCompanyLinked?: (match: CompanyProspectMatch) => void
  /**
   * Fired once when the user starts editing in Add New Company.
   * Parent should snapshot + clear prior company-derived contact fields.
   */
  onCompanyCreateTyping?: () => void
  /**
   * Fired when Add New Company is cancelled after the user typed
   * (company value is restored by this control; parent restores contact fields).
   */
  onCompanyCreateCancel?: () => void
  /** Called when focus leaves the control (Tab / click away). Use for required-field validation. */
  onBlur?: () => void
  /** Border / aria invalid. Prefer parent `ErpFieldRow.fieldError` for the message text. */
  error?: string | boolean
  disabled?: boolean
  autoFocus?: boolean
}

export function CompanyProspectSelect({
  value,
  onChange,
  onCompanyLinked,
  onCompanyCreateTyping,
  onCompanyCreateCancel,
  onBlur,
  error,
  disabled,
  autoFocus,
}: CompanyProspectSelectProps) {
  const listboxId = useId()
  const customers = useActiveCustomers()
  const contacts = useMasterStore((s) => s.customerContacts)
  const { canCreate } = useQuickCreate()
  const [query, setQuery] = useState(value.prospectName)
  const [filterQuery, setFilterQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [companyModalDefaultName, setCompanyModalDefaultName] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const companyCreateSnapshotRef = useRef<CompanyProspectValue | null>(null)
  const companyCreateClearedRef = useRef(false)

  const activeQuery = open ? (filterQuery !== '' ? filterQuery : query) : query

  const suggestions = useMemo(() => {
    const q = activeQuery.trim()
    if (!q) return []
    return searchCompanyProspects(customers, contacts, q)
  }, [customers, contacts, activeQuery])

  const displayValue = activeQuery
  const showList = open && activeQuery.trim().length > 0 && suggestions.length > 0
  const activeOptionId = showList ? `${listboxId}-opt-${highlightIndex}` : undefined

  useEffect(() => {
    // Do not wipe the visible name when parent has a link but empty prospectName —
    // the recovery effect below repairs parent state.
    if (value.customerId && !value.prospectName.trim()) return
    setQuery(value.prospectName)
  }, [value.prospectName, value.customerId])

  // If parent has a linked company but empty name, recover it into the field + parent state
  useEffect(() => {
    if (!value.customerId || value.prospectName.trim()) return
    const linked = customers.find((c) => c.id === value.customerId)
    if (!linked?.customerName) return
    setQuery(linked.customerName)
    onChange({ customerId: value.customerId, prospectName: linked.customerName })
    // onChange is unstable from parent; only re-run when the value pair needs repair
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.customerId, value.prospectName, customers])

  useEffect(() => {
    if (!open) {
      setFilterQuery('')
      setHighlightIndex(0)
    }
  }, [open])

  useEffect(() => {
    setHighlightIndex(0)
  }, [activeQuery])

  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  useEffect(() => {
    if (!showList) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, showList])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function selectMatch(match: CompanyProspectMatch) {
    setQuery(match.customerName)
    setFilterQuery('')
    setOpen(false)
    setDuplicateWarning(null)
    onChange({ customerId: match.customerId, prospectName: match.customerName })
    onCompanyLinked?.(match)
  }

  function handleQueryChange(text: string) {
    setFilterQuery(text)
    setQuery(text)
    setOpen(true)
    setHighlightIndex(0)
    onChange({ customerId: null, prospectName: text })
    const similar = findSimilarCompanies(customers, text)
    if (text.trim().length >= 3 && similar.length > 0 && !value.customerId) {
      setDuplicateWarning(`Similar company exists: ${similar[0].customerName}. Select from suggestions to avoid duplicates.`)
    } else {
      setDuplicateWarning(null)
    }
  }

  /** Persist Company Master FK when the typed name exactly matches an active company. */
  function commitExactMatchIfNeeded() {
    if (value.customerId) return
    const exact = findExactCompanyByName(customers, query)
    if (!exact) return
    selectMatch({
      customerId: exact.id,
      customerName: exact.customerName,
      city: exact.city ?? '—',
      industry: exact.industry ?? '—',
      contactPerson: exact.contactPerson ?? '',
      contactPhone: exact.contactPhone ?? '',
      contactEmail: exact.contactEmail ?? '',
      customerType: exact.customerType ?? 'corporate',
      salesTerritory: exact.salesTerritory ?? 'West',
      sourceLabel: exact.isCustomer ? 'Customer' : 'Prospect',
      statusLabel: exact.isActive ? 'Active' : 'Inactive',
      matchScore: 100,
    })
  }

  function handleAddCompany() {
    if (!canCreate('customer')) return
    companyCreateSnapshotRef.current = {
      customerId: value.customerId,
      prospectName: value.prospectName,
    }
    companyCreateClearedRef.current = false
    setCompanyModalDefaultName(query.trim() || value.prospectName.trim())
    setOpen(false)
    setCompanyModalOpen(true)
  }

  function handleCompanyCreateTyping() {
    if (companyCreateClearedRef.current) return
    companyCreateClearedRef.current = true
    // Snapshot parent contact fields before unlinking company (parents may clear
    // contact person when customerId becomes null).
    onCompanyCreateTyping?.()
    setQuery('')
    setFilterQuery('')
    setDuplicateWarning(null)
    onChange({ customerId: null, prospectName: '' })
  }

  function handleCompanyCreateDismiss() {
    if (companyCreateClearedRef.current && companyCreateSnapshotRef.current) {
      const snap = companyCreateSnapshotRef.current
      setQuery(snap.prospectName)
      setFilterQuery('')
      onCompanyCreateCancel?.()
      onChange(snap)
    }
    companyCreateSnapshotRef.current = null
    companyCreateClearedRef.current = false
    setCompanyModalOpen(false)
  }

  function handleCompanyCreated(result: QuickCreateResult) {
    companyCreateSnapshotRef.current = null
    companyCreateClearedRef.current = false
    const c = (useMasterStore.getState().getCustomer(result.id) ?? result.record) as Customer | undefined
    const name = c?.customerName ?? result.label
    if (!result.id || !name) return
    selectMatch({
      customerId: result.id,
      customerName: name,
      city: c?.city ?? '—',
      industry: c?.industry ?? '—',
      contactPerson: c?.contactPerson ?? '',
      contactPhone: c?.contactPhone ?? '',
      contactEmail: c?.contactEmail ?? '',
      customerType: c?.customerType ?? 'corporate',
      salesTerritory: c?.salesTerritory ?? 'West',
      sourceLabel: 'New',
      statusLabel: 'Active',
      matchScore: 100,
    })
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (suggestions.length === 0) return
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (suggestions.length === 0) return
      setHighlightIndex((i) => Math.max(i - 1, 0))
      return
    }

    if (e.key === 'Home' && open && suggestions.length > 0) {
      e.preventDefault()
      setHighlightIndex(0)
      return
    }

    if (e.key === 'End' && open && suggestions.length > 0) {
      e.preventDefault()
      setHighlightIndex(suggestions.length - 1)
      return
    }

    if (e.key === 'Enter') {
      if (open && suggestions[highlightIndex]) {
        e.preventDefault()
        selectMatch(suggestions[highlightIndex])
      }
      return
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setFilterQuery('')
      }
      return
    }

    if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="crm-company-prospect">
      <div className="crm-company-prospect__search-row">
        <div className="erp-search-field flex-1">
          <Search className="erp-search-field__icon" strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-invalid={Boolean(error)}
            className={cn('erp-input erp-search-field__input w-full', error && 'border-erp-danger-solid')}
            value={displayValue}
            disabled={disabled}
            placeholder="Start typing company name — pick from list or enter new prospect"
            onChange={(e) => handleQueryChange(e.target.value)}
            onClick={() => {
              if (!disabled) setOpen(true)
            }}
            onFocus={() => {
              if (!disabled) setOpen(true)
            }}
            onBlur={() => {
              // Defer so listbox mousedown/click can select first
              window.setTimeout(() => {
                if (wrapRef.current?.contains(document.activeElement)) return
                setOpen(false)
                commitExactMatchIfNeeded()
                onBlur?.()
              }, 0)
            }}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            autoFocus={autoFocus}
          />
        </div>
        <ErpButton
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={disabled || !canCreate('customer')}
          onClick={handleAddCompany}
        >
          Add New Company
        </ErpButton>
      </div>

      {duplicateWarning ? (
        <p className="crm-company-prospect__warn">{duplicateWarning}</p>
      ) : null}

      {open && !activeQuery.trim() ? (
        <p className="crm-company-prospect__hint erp-dropdown-panel px-3 py-2 text-[12px] text-erp-muted">
          Type a company name to search. Use ↑ ↓ to move, Enter to select, Esc to close.
        </p>
      ) : null}

      {showList ? (
        <ul
          ref={listRef}
          id={listboxId}
          className="crm-company-prospect__dropdown erp-dropdown-panel"
          role="listbox"
          aria-label="Company matches"
        >
          {suggestions.map((s, index) => (
            <li key={s.customerId} role="presentation">
              <button
                type="button"
                id={`${listboxId}-opt-${index}`}
                data-option-index={index}
                role="option"
                aria-selected={index === highlightIndex}
                tabIndex={-1}
                className={cn(
                  'crm-company-prospect__option erp-dropdown-option',
                  index === highlightIndex && 'erp-dropdown-option--active',
                )}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectMatch(s)}
              >
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" />
                  <div className="min-w-0 text-left">
                    <p className="erp-dropdown-option__title">{s.customerName}</p>
                    <p className="erp-dropdown-option__meta">
                      {s.city}
                      {' · '}
                      {s.industry}
                      {' · '}
                      {s.contactPerson}
                    </p>
                    <p className="erp-dropdown-option__meta">
                      {s.statusLabel}
                      {' · '}
                      {s.salesTerritory}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && activeQuery.trim() && suggestions.length === 0 ? (
        <p className="crm-company-prospect__hint erp-dropdown-panel px-3 py-2 text-[12px] text-erp-muted">
          No matches. Keep typing a new prospect name, or press Tab then Enter on Add New Company.
        </p>
      ) : null}

      {value.customerId ? (
        <p className="crm-company-prospect__linked">
          Linked to Company Master
        </p>
      ) : value.prospectName.trim() ? (
        <p className="crm-company-prospect__hint text-[12px] text-erp-muted">
          Prospect name only — pick a company from the list or Add New Company to link before converting to an opportunity.
        </p>
      ) : null}

      <QuickCompanyCreateModal
        open={companyModalOpen}
        defaultName={companyModalDefaultName}
        onClose={handleCompanyCreateDismiss}
        onCreated={handleCompanyCreated}
        onUserEdit={handleCompanyCreateTyping}
      />
    </div>
  )
}
