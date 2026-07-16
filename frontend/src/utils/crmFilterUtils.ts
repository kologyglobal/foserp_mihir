import type { FilterChip } from '../components/design-system/SmartFilterBar'
import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'

export const CRM_DATE_PRESETS = [
  { id: '', label: 'Custom range' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'last_quarter', label: 'Last Quarter' },
] as const

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function resolveDatePresetRange(preset: string): { from: string; to: string } {
  const today = startOfDay(new Date())
  const end = new Date(today)

  switch (preset) {
    case 'today':
      return { from: toIsoDate(today), to: toIsoDate(end) }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { from: toIsoDate(y), to: toIsoDate(y) }
    }
    case 'this_week': {
      const start = new Date(today)
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
    case 'last_week': {
      const start = new Date(today)
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff - 7)
      const lastEnd = new Date(start)
      lastEnd.setDate(lastEnd.getDate() + 6)
      return { from: toIsoDate(start), to: toIsoDate(lastEnd) }
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toIsoDate(start), to: toIsoDate(lastEnd) }
    }
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3)
      const start = new Date(today.getFullYear(), q * 3, 1)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
    case 'last_quarter': {
      const q = Math.floor(today.getMonth() / 3) - 1
      const year = q < 0 ? today.getFullYear() - 1 : today.getFullYear()
      const quarter = q < 0 ? 3 : q
      const start = new Date(year, quarter * 3, 1)
      const lastEnd = new Date(year, quarter * 3 + 3, 0)
      return { from: toIsoDate(start), to: toIsoDate(lastEnd) }
    }
    default:
      return { from: '', to: '' }
  }
}

export function countActiveCrmFilters(
  values: CrmFilterValues,
  excludeKeys: string[] = ['search', 'sortBy', 'sort'],
): number {
  let count = 0
  for (const [key, value] of Object.entries(values)) {
    if (excludeKeys.includes(key)) continue
    if (typeof value === 'boolean') {
      if (value) count += 1
    } else if (Array.isArray(value)) {
      if (value.length > 0) count += 1
    } else if (value) {
      count += 1
    }
  }
  return count
}

export function buildCrmFilterChips(
  values: CrmFilterValues,
  fields: CrmFilterField[],
  labelResolver?: (key: string, value: string) => string | undefined,
): FilterChip[] {
  const chips: FilterChip[] = []

  if (values.search && typeof values.search === 'string' && values.search.trim()) {
    chips.push({ id: 'search', label: `Search: ${values.search}` })
  }

  for (const field of fields) {
    if (field.type === 'select' || field.type === 'search-select') {
      const raw = values[field.key]
      if (typeof raw === 'string' && raw) {
        const label = labelResolver?.(field.key, raw)
          ?? field.options.find((o) => o.value === raw)?.label
          ?? raw
        chips.push({ id: field.key, label: `${field.label}: ${label}` })
      }
    }
    if (field.type === 'multi-select') {
      const raw = values[field.key]
      if (Array.isArray(raw) && raw.length > 0) {
        const labels = raw.map(
          (v) => field.options.find((o) => o.value === v)?.label ?? v,
        )
        chips.push({ id: field.key, label: `${field.label}: ${labels.join(', ')}` })
      }
    }
    if (field.type === 'date-range') {
      const from = values[field.fromKey]
      const to = values[field.toKey]
      if (typeof from === 'string' && from) {
        chips.push({ id: field.fromKey, label: `${field.label} from ${from}` })
      }
      if (typeof to === 'string' && to) {
        chips.push({ id: field.toKey, label: `${field.label} to ${to}` })
      }
    }
    if (field.type === 'number-range') {
      const min = values[field.minKey]
      const max = values[field.maxKey]
      if (typeof min === 'string' && min) {
        chips.push({ id: field.minKey, label: `${field.label} ≥ ${min}` })
      }
      if (typeof max === 'string' && max) {
        chips.push({ id: field.maxKey, label: `${field.label} ≤ ${max}` })
      }
    }
    if (field.type === 'boolean') {
      if (values[field.key] === true) {
        chips.push({ id: field.key, label: field.label })
      }
    }
  }

  return chips
}

export function patchCrmFilterValues(
  values: CrmFilterValues,
  patch: Partial<CrmFilterValues>,
): CrmFilterValues {
  return { ...values, ...patch } as CrmFilterValues
}

export function clearCrmFilterChip(
  values: CrmFilterValues,
  chipId: string,
  fields: CrmFilterField[],
): CrmFilterValues {
  const next = { ...values }
  if (chipId === 'search') {
    next.search = ''
    return next
  }
  for (const field of fields) {
    if (field.type === 'select' || field.type === 'search-select' || field.type === 'boolean') {
      if (field.key === chipId) {
        next[field.key] = field.type === 'boolean' ? false : ''
      }
    }
    if (field.type === 'multi-select' && field.key === chipId) {
      next[field.key] = []
    }
    if (field.type === 'date-range') {
      if (chipId === field.fromKey) next[field.fromKey] = ''
      if (chipId === field.toKey) next[field.toKey] = ''
    }
    if (field.type === 'number-range') {
      if (chipId === field.minKey) next[field.minKey] = ''
      if (chipId === field.maxKey) next[field.maxKey] = ''
    }
  }
  return next
}

export function resetCrmFilterValues(
  defaults: CrmFilterValues,
  fields: CrmFilterField[],
): CrmFilterValues {
  const next = { ...defaults }
  for (const field of fields) {
    if (field.type === 'select' || field.type === 'search-select') next[field.key] = ''
    if (field.type === 'multi-select') next[field.key] = []
    if (field.type === 'date-range') {
      next[field.fromKey] = ''
      next[field.toKey] = ''
    }
    if (field.type === 'number-range') {
      next[field.minKey] = ''
      next[field.maxKey] = ''
    }
    if (field.type === 'boolean') next[field.key] = false
  }
  return next
}
