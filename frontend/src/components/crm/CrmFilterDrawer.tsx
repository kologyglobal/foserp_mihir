import { useState } from 'react'
import { Search } from 'lucide-react'
import { CrmDrawerShell } from './CrmDrawerShell'
import { FormField } from '../forms/FormField'
import { Input, Select } from '../forms/Inputs'
import { ErpButton } from '../erp/ErpButton'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import type { CrmFilterField, CrmFilterValues } from '../../types/crmListFilters'
import { toSmartSelectOptions } from '../../types/crmListFilters'
import { CRM_DATE_PRESETS, resolveDatePresetRange } from '../../utils/crmFilterUtils'
import { cn } from '../../utils/cn'

export interface CrmFilterDrawerProps {
  open: boolean
  onClose: () => void
  fields: CrmFilterField[]
  values: CrmFilterValues
  onChange: (values: CrmFilterValues) => void
  onApply: () => void
  onReset: () => void
  /** Future-ready saved views slot */
  savedViewsSlot?: React.ReactNode
}

function CrmFilterMultiSelect({
  options,
  values,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const filtered = options.filter((o) =>
  `${o.label} ${o.value}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="crm-filter-multi">
      <div className="crm-filter-multi__search">
        <Search className="h-4 w-4 text-erp-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search…'}
          className="crm-filter-multi__search-input"
          aria-label="Search options"
        />
      </div>
      <div className="crm-filter-multi__list" role="listbox" aria-multiselectable>
        {filtered.length === 0 ? (
          <p className="crm-filter-multi__empty">No matches found</p>
        ) : (
          filtered.map((opt) => {
            const checked = values.includes(opt.value)
            return (
              <label key={opt.value} className={cn('crm-filter-multi__option', checked && 'crm-filter-multi__option--checked')}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

function DateRangeField({
  field,
  values,
  onChange,
}: {
  field: Extract<CrmFilterField, { type: 'date-range' }>
  values: CrmFilterValues
  onChange: (patch: CrmFilterValues) => void
}) {
  const from = (values[field.fromKey] as string) ?? ''
  const to = (values[field.toKey] as string) ?? ''

  return (
    <section className="crm-filter-field">
      <h3 className="crm-filter-field__label">{field.label}</h3>
      {field.presets !== false ? (
        <FormField label="Preset">
          <Select
            value=""
            onChange={(e) => {
              const range = resolveDatePresetRange(e.target.value)
              onChange({ [field.fromKey]: range.from, [field.toKey]: range.to })
            }}
            className="h-10"
          >
            {CRM_DATE_PRESETS.map((p) => (
              <option key={p.id || 'custom'} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <div className="crm-filter-field__row">
        <FormField label="From">
          <Input
            type="date"
            value={from}
            onChange={(e) => onChange({ [field.fromKey]: e.target.value })}
          />
        </FormField>
        <FormField label="To">
          <Input
            type="date"
            value={to}
            onChange={(e) => onChange({ [field.toKey]: e.target.value })}
          />
        </FormField>
      </div>
    </section>
  )
}

export function CrmFilterDrawer({
  open,
  onClose,
  fields,
  values,
  onChange,
  onApply,
  onReset,
  savedViewsSlot,
}: CrmFilterDrawerProps) {
  function patch(patch: CrmFilterValues) {
    onChange({ ...values, ...patch })
  }

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title="Filters"
      width="filter"
      variant="filter"
      footer={(
        <div className="crm-filter-drawer__footer">
          <ErpButton type="button" variant="ghost" onClick={onReset}>
            Reset Filters
          </ErpButton>
          <ErpButton type="button" variant="primary" onClick={onApply}>
            Apply Filters
          </ErpButton>
        </div>
      )}
    >
      <div className="crm-filter-drawer">
        {savedViewsSlot ? (
          <section className="crm-filter-drawer__saved-views" aria-label="Saved filter views">
            {savedViewsSlot}
          </section>
        ) : null}

        {fields.map((field, index) => {
          if (field.type === 'section') {
            return (
              <div key={`section-${index}`} className="crm-filter-drawer__section-label">
                {field.label}
              </div>
            )
          }

          if (field.type === 'select' || field.type === 'search-select') {
            const raw = values[field.key]
            const value = typeof raw === 'string' ? raw : ''
            return (
              <FormField key={field.key} label={field.label}>
                {field.type === 'search-select' ? (
                  <ErpSmartSelect
                    options={toSmartSelectOptions(field.options)}
                    value={value}
                    onChange={(v) => patch({ [field.key]: v })}
                    placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}…`}
                    allowEmpty
                  />
                ) : (
                  <Select
                    value={value}
                    onChange={(e) => patch({ [field.key]: e.target.value })}
                    className="h-10"
                  >
                    <option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                )}
              </FormField>
            )
          }

          if (field.type === 'multi-select') {
            const raw = values[field.key]
            const selected = Array.isArray(raw) ? raw : []
            return (
              <FormField key={field.key} label={field.label}>
                <CrmFilterMultiSelect
                  options={field.options}
                  values={selected}
                  onChange={(next) => patch({ [field.key]: next })}
                  placeholder={field.placeholder}
                />
              </FormField>
            )
          }

          if (field.type === 'date-range') {
            return (
              <DateRangeField
                key={`${field.fromKey}-${field.toKey}`}
                field={field}
                values={values}
                onChange={patch}
              />
            )
          }

          if (field.type === 'number-range') {
            const min = (values[field.minKey] as string) ?? ''
            const max = (values[field.maxKey] as string) ?? ''
            return (
              <section key={`${field.minKey}-${field.maxKey}`} className="crm-filter-field">
                <h3 className="crm-filter-field__label">{field.label}</h3>
                <div className="crm-filter-field__row">
                  <FormField label="Min">
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={min}
                      onChange={(e) => patch({ [field.minKey]: e.target.value })}
                      placeholder={field.minPlaceholder}
                    />
                  </FormField>
                  <FormField label="Max">
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={max}
                      onChange={(e) => patch({ [field.maxKey]: e.target.value })}
                      placeholder={field.maxPlaceholder}
                    />
                  </FormField>
                </div>
              </section>
            )
          }

          if (field.type === 'boolean') {
            const checked = values[field.key] === true
            return (
              <label key={field.key} className="crm-filter-boolean">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => patch({ [field.key]: e.target.checked })}
                />
                <span>{field.label}</span>
              </label>
            )
          }

          return null
        })}
      </div>
    </CrmDrawerShell>
  )
}
