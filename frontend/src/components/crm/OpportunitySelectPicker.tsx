import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Search, Target } from 'lucide-react'
import type { Opportunity } from '../../types/crm'
import type { Customer, Product } from '../../types/master'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { opportunityPriorityLabel, opportunityStageLabel } from '../../utils/opportunityUtils'
import { opportunityRequirementDisplay } from '../../utils/leadRequirementLines'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { cn } from '../../utils/cn'

export interface OpportunityOption {
  opportunity: Opportunity
  customerName: string
  customerCity: string
  productLabel: string
  searchText: string
}

interface OpportunitySelectPickerProps {
  opportunities: Opportunity[]
  customers: Customer[]
  products: Product[]
  value: string
  onChange: (opportunityId: string) => void
  disabled?: boolean
}

function buildOptions(
  opportunities: Opportunity[] | null | undefined,
  customers: Customer[] | null | undefined,
  products: Product[] | null | undefined,
): OpportunityOption[] {
  const opps = Array.isArray(opportunities) ? opportunities : []
  const custs = Array.isArray(customers) ? customers : []
  const prods = Array.isArray(products) ? products : []
  return opps.map((opportunity) => {
    const customer = custs.find((c) => c.id === opportunity.customerId)
    const product = opportunity.productId
      ? prods.find((p) => p.id === opportunity.productId)
      : undefined
    const productLabel = product
      ? `${product.productCode} — ${product.productName}`
      : opportunityRequirementDisplay(opportunity.productRequirement) || 'No product linked'

    const customerName = customer?.customerName ?? 'Unknown customer'
    const customerCity = customer?.city ?? '—'

    const searchText = [
      opportunity.opportunityNo,
      opportunity.opportunityName,
      customerName,
      customerCity,
      productLabel,
      opportunity.ownerName,
      opportunityStageLabel(opportunity.stage),
      opportunityRequirementDisplay(opportunity.productRequirement),
    ].join(' ').toLowerCase()

    return {
      opportunity,
      customerName,
      customerCity,
      productLabel,
      searchText,
    }
  })
}

function formatSelectedLabel(option: OpportunityOption): string {
  const { opportunity, customerName } = option
  return `${opportunity.opportunityNo} · ${opportunity.opportunityName} · ${customerName}`
}

export function OpportunitySelectPicker({
  opportunities,
  customers,
  products,
  value,
  onChange,
  disabled,
}: OpportunitySelectPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})

  const options = useMemo(
    () => buildOptions(opportunities, customers, products),
    [opportunities, customers, products],
  )

  const selected = options.find((o) => o.opportunity.id === value)

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.searchText.includes(q))
  }, [options, filterQuery])

  const displayValue = open
    ? (filterQuery !== '' ? filterQuery : (selected ? formatSelectedLabel(selected) : ''))
    : (selected ? formatSelectedLabel(selected) : '')

  useEffect(() => {
    if (!open) setFilterQuery('')
  }, [open])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function updateDropdownPosition() {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const maxHeight = Math.min(360, Math.max(160, spaceBelow))
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 10050,
    })
  }

  useEffect(() => {
    if (!open) return
    updateDropdownPosition()
    const onReflow = () => updateDropdownPosition()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, filtered.length, filterQuery])

  function openList() {
    if (disabled) return
    setFilterQuery('')
    setOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      if (selected) inputRef.current?.select()
    })
  }

  function selectOption(option: OpportunityOption) {
    setFilterQuery('')
    setOpen(false)
    onChange(option.opportunity.id)
  }

  function handleFilterChange(text: string) {
    setFilterQuery(text)
    setOpen(true)
    if (!text.trim()) onChange('')
  }

  return (
    <div ref={wrapRef} className="crm-opp-picker">
      <div ref={anchorRef} className="erp-search-field" onClick={() => openList()}>
        <Search className="erp-search-field__icon" strokeWidth={2} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="erp-input erp-search-field__input w-full"
          value={displayValue}
          disabled={disabled}
          placeholder="Search by deal no, name, customer, product, owner, or stage…"
          aria-label="Opportunity"
          onChange={(e) => handleFilterChange(e.target.value)}
          onFocus={() => {
            if (disabled) return
            if (!open) openList()
          }}
          autoComplete="off"
        />
      </div>

      {open && !disabled
        ? createPortal(
          <div
            ref={dropdownRef}
            className="crm-opp-picker__dropdown crm-opp-picker__dropdown--portal erp-dropdown-panel"
            style={dropdownStyle}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <p className="crm-opp-picker__empty">No matching open opportunities.</p>
            ) : (
              <ul className="crm-opp-picker__list">
                {filtered.map((option) => {
                  const { opportunity } = option
                  const isSelected = opportunity.id === value
                  return (
                    <li key={opportunity.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'crm-opp-picker__option erp-dropdown-option',
                          isSelected && 'crm-opp-picker__option--selected',
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectOption(option)}
                      >
                        <div className="crm-opp-picker__option-head">
                          <Target className="crm-opp-picker__icon" />
                          <div className="min-w-0 flex-1 text-left">
                            <p className="erp-dropdown-option__title">{opportunity.opportunityName}</p>
                            <p className="erp-dropdown-option__meta">
                              {opportunity.opportunityNo}
                              {' · '}
                              {option.customerName}
                              {option.customerCity !== '—' ? ` · ${option.customerCity}` : ''}
                            </p>
                          </div>
                          <div className="crm-opp-picker__value">
                            <p className="crm-opp-picker__amount">{formatCrmCurrency(opportunity.value)}</p>
                            <p className="crm-opp-picker__prob">{opportunity.probability}%</p>
                          </div>
                        </div>

                        <p className="crm-opp-picker__product">{option.productLabel}</p>

                        <div className="crm-opp-picker__footer">
                          <DynamicsStatusChip
                            label={opportunityStageLabel(opportunity.stage)}
                            tone="info"
                          />
                          <span className="crm-opp-picker__footer-meta">
                            {opportunityPriorityLabel(opportunity.priority)}
                            {' · '}
                            {opportunity.ownerName}
                            {' · Close '}
                            {opportunity.expectedCloseDate?.slice(0, 10) ?? '—'}
                          </span>
                          {opportunity.quotationId ? (
                            <span className="crm-opp-picker__badge">Has quotation</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
        : null}

      {!open && selected ? (
        <p className="crm-opp-picker__hint">
          {selected.opportunity.opportunityNo} · {selected.customerName} · {formatCrmCurrency(selected.opportunity.value)}
        </p>
      ) : null}
    </div>
  )
}
