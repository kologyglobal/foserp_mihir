import type { ErpSmartSelectOption } from '../components/erp/ErpSmartSelect'

export type CrmFilterFieldType =
  | 'select'
  | 'search-select'
  | 'multi-select'
  | 'date-range'
  | 'number-range'
  | 'boolean'
  | 'section'

export interface CrmFilterSelectField {
  type: 'select' | 'search-select'
  key: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export interface CrmFilterMultiSelectField {
  type: 'multi-select'
  key: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export interface CrmFilterDateRangeField {
  type: 'date-range'
  label: string
  fromKey: string
  toKey: string
  presets?: boolean
}

export interface CrmFilterNumberRangeField {
  type: 'number-range'
  label: string
  minKey: string
  maxKey: string
  minPlaceholder?: string
  maxPlaceholder?: string
  min?: number
  max?: number
}

export interface CrmFilterBooleanField {
  type: 'boolean'
  key: string
  label: string
}

export interface CrmFilterSectionField {
  type: 'section'
  label: string
}

export type CrmFilterField =
  | CrmFilterSelectField
  | CrmFilterMultiSelectField
  | CrmFilterDateRangeField
  | CrmFilterNumberRangeField
  | CrmFilterBooleanField
  | CrmFilterSectionField

export type CrmFilterValues = Record<string, string | string[] | boolean>

export function toSmartSelectOptions(
  options: { value: string; label: string }[],
): ErpSmartSelectOption[] {
  return options.map((o) => ({
    value: o.value,
    label: o.label,
    searchText: `${o.label} ${o.value}`.toLowerCase(),
  }))
}
