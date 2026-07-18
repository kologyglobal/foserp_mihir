import type { ReactNode } from 'react'
import { Input, Select, Textarea } from '../../forms/Inputs'
import { ColorPickerField } from '../../forms/ColorPickerField'
import { MasterMultiSelectField } from '../../forms/MasterMultiSelectField'
import { ErpRichTextEditor } from '../../forms/ErpRichTextEditor'
import type { CrmMasterFieldDef } from '../../../types/crmMasters'
import { cn } from '../../../utils/cn'

export function masterFieldIsWide(field: CrmMasterFieldDef) {
  return field.type === 'textarea' || field.type === 'color' || field.type === 'multiselect' || field.type === 'richtext'
}

export function MasterFormField({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={cn('block text-sm', wide && 'md:col-span-2')}>
      <span className="font-medium text-erp-text">
        {label}
        {required ? <span className="text-erp-danger"> *</span> : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export function MasterFieldInput({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: CrmMasterFieldDef
  value: string
  onChange: (v: string) => void
  compact?: boolean
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
        {field.label}
      </label>
    )
  }
  if (field.type === 'textarea') {
    return <Textarea rows={compact ? 2 : 3} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'select' && field.options) {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }
  if (field.type === 'color') {
    return <ColorPickerField value={value} onChange={onChange} />
  }
  if (field.type === 'multiselect' && field.options) {
    return <MasterMultiSelectField value={value} onChange={onChange} options={field.options} />
  }
  if (field.type === 'richtext') {
    return <ErpRichTextEditor value={value} onChange={onChange} minHeight={compact ? 120 : 220} />
  }
  return (
    <Input
      type={field.key === 'effectiveDate' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}

export function renderCatalogField(
  field: CrmMasterFieldDef,
  value: string,
  onChange: (v: string) => void,
) {
  if (field.type === 'boolean') {
    return (
      <div key={field.key} className="flex items-end md:col-span-2">
        <MasterFieldInput field={field} value={value} onChange={onChange} compact />
      </div>
    )
  }
  return (
    <MasterFormField key={field.key} label={field.label} required={field.required} wide={masterFieldIsWide(field)}>
      <MasterFieldInput field={field} value={value} onChange={onChange} compact />
    </MasterFormField>
  )
}
