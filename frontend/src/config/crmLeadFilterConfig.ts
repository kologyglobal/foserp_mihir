import type { CrmFilterField } from '../types/crmListFilters'
import {
  leadPriorityFilterOptions,
  leadStageFilterOptions,
  leadDisplayStatusLabel,
  type LeadListFilters,
} from '../utils/leadListUtils'
import type { LeadDisplayStatus } from '../utils/leadListUtils'

export function buildLeadFilterFields(input: {
  ownerOptions: string[]
  sourceOptions: string[]
  industryOptions: string[]
}): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'stage',
      label: 'Lead Stage',
      options: leadStageFilterOptions().map((o) => ({ value: o.id, label: o.label })),
    },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: (['active', 'inactive', 'open', 'closed', 'converted'] as const).map((s) => ({
        value: s,
        label: leadDisplayStatusLabel(s),
      })),
    },
    {
      type: 'search-select',
      key: 'owner',
      label: 'Owner',
      options: input.ownerOptions.map((o) => ({ value: o, label: o })),
      placeholder: 'Search owner…',
    },
    {
      type: 'search-select',
      key: 'source',
      label: 'Lead Source',
      options: input.sourceOptions.map((s) => ({ value: s, label: s })),
      placeholder: 'Search source…',
    },
    {
      type: 'search-select',
      key: 'industry',
      label: 'Industry',
      options: input.industryOptions.map((i) => ({ value: i, label: i })),
      placeholder: 'Search industry…',
    },
    {
      type: 'select',
      key: 'priority',
      label: 'Priority',
      options: leadPriorityFilterOptions().map((p) => ({ value: p.id, label: p.label })),
    },
    {
      type: 'date-range',
      label: 'Date Range',
      fromKey: 'dateFrom',
      toKey: 'dateTo',
    },
    {
      type: 'date-range',
      label: 'Last Modified',
      fromKey: 'modifiedFrom',
      toKey: 'modifiedTo',
    },
    {
      type: 'number-range',
      label: 'Probability %',
      minKey: 'probMin',
      maxKey: 'probMax',
      min: 0,
      max: 100,
      minPlaceholder: 'e.g. 20',
      maxPlaceholder: 'e.g. 80',
    },
    {
      type: 'number-range',
      label: 'Expected Value (₹)',
      minKey: 'valueMin',
      maxKey: 'valueMax',
      minPlaceholder: 'e.g. 500000',
      maxPlaceholder: 'e.g. 5000000',
    },
  ]
}

export function leadFiltersToCrmValues(filters: LeadListFilters): Record<string, string | boolean | string[]> {
  return { ...filters }
}

export function crmValuesToLeadFilters(values: Record<string, string | boolean | string[]>): LeadListFilters {
  return {
    search: String(values.search ?? ''),
    stage: String(values.stage ?? ''),
    status: String(values.status ?? ''),
    owner: String(values.owner ?? ''),
    source: String(values.source ?? ''),
    industry: String(values.industry ?? ''),
    priority: String(values.priority ?? ''),
    probMin: String(values.probMin ?? ''),
    probMax: String(values.probMax ?? ''),
    valueMin: String(values.valueMin ?? ''),
    valueMax: String(values.valueMax ?? ''),
    dateFrom: String(values.dateFrom ?? ''),
    dateTo: String(values.dateTo ?? ''),
    modifiedFrom: String(values.modifiedFrom ?? ''),
    modifiedTo: String(values.modifiedTo ?? ''),
  }
}

export function leadFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'stage') {
    return leadStageFilterOptions().find((o) => o.id === value)?.label
  }
  if (key === 'status') {
    return leadDisplayStatusLabel(value as LeadDisplayStatus)
  }
  if (key === 'priority') {
    return leadPriorityFilterOptions().find((p) => p.id === value)?.label
  }
  return undefined
}
