import { FormField } from '../forms/FormField'
import { Input, Select } from '../forms/Inputs'
import { ErpButton } from '../erp/ErpButton'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import type { CrmFilterField, CrmFilterValues } from '../../types/crmListFilters'
import { toSmartSelectOptions } from '../../types/crmListFilters'
import { CRM_DATE_PRESETS, resolveDatePresetRange } from '../../utils/crmFilterUtils'
import { cn } from '../../utils/cn'

export interface CrmInlineFilterPanelProps {
  fields: CrmFilterField[]
  values: CrmFilterValues
  onChange: (values: CrmFilterValues) => void
  onReset: () => void
  onClose: () => void
  className?: string
}

/**
 * Expandable filter row under the register Filters button.
 * Draft values live in the parent; Apply happens via the toolbar button.
 */
export function CrmInlineFilterPanel({
  fields,
  values,
  onChange,
  onReset,
  onClose,
  className,
}: CrmInlineFilterPanelProps) {
  function patch(next: CrmFilterValues) {
    onChange({ ...values, ...next })
  }

  return (
    <div
      className={cn('crm-inline-filter-panel', className)}
      role="region"
      aria-label="Filter options"
    >
      <div className="crm-inline-filter-panel__grid">
        {fields.map((field, index) => {
          if (field.type === 'section') {
            return (
              <p
                key={`section-${index}`}
                className="crm-inline-filter-panel__section"
              >
                {field.label}
              </p>
            )
          }

          if (field.type === 'select' || field.type === 'search-select') {
            const raw = values[field.key]
            const value = typeof raw === 'string' ? raw : ''
            return (
              <FormField key={field.key} label={field.label} className="crm-inline-filter-panel__field">
                {field.type === 'search-select' ? (
                  <ErpSmartSelect
                    options={toSmartSelectOptions(field.options)}
                    value={value}
                    onChange={(v) => patch({ [field.key]: v })}
                    placeholder={field.placeholder ?? `All ${field.label.toLowerCase()}`}
                    allowEmpty
                    compact
                  />
                ) : (
                  <Select
                    value={value}
                    onChange={(e) => patch({ [field.key]: e.target.value })}
                  >
                    <option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            )
          }

          if (field.type === 'date-range') {
            const from = (values[field.fromKey] as string) ?? ''
            const to = (values[field.toKey] as string) ?? ''
            return (
              <div
                key={`${field.fromKey}-${field.toKey}`}
                className="crm-inline-filter-panel__date-range"
              >
                <p className="crm-inline-filter-panel__date-label">{field.label}</p>
                <div className="crm-inline-filter-panel__date-fields">
                  {field.presets !== false ? (
                    <FormField label="Preset" className="crm-inline-filter-panel__field">
                      <Select
                        value=""
                        onChange={(e) => {
                          const range = resolveDatePresetRange(e.target.value)
                          patch({ [field.fromKey]: range.from, [field.toKey]: range.to })
                        }}
                      >
                        {CRM_DATE_PRESETS.map((p) => (
                          <option key={p.id || 'custom'} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  ) : null}
                  <FormField label="From" className="crm-inline-filter-panel__field">
                    <Input
                      type="date"
                      value={from}
                      onChange={(e) => patch({ [field.fromKey]: e.target.value })}
                    />
                  </FormField>
                  <FormField label="To" className="crm-inline-filter-panel__field">
                    <Input
                      type="date"
                      value={to}
                      onChange={(e) => patch({ [field.toKey]: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            )
          }

          if (field.type === 'boolean') {
            const checked = values[field.key] === true
            return (
              <label key={field.key} className="crm-inline-filter-panel__boolean">
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

      <div className="crm-inline-filter-panel__footer">
        <ErpButton type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </ErpButton>
        <ErpButton type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </ErpButton>
      </div>
    </div>
  )
}
