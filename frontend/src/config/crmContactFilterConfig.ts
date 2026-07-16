import type { CrmFilterField } from '../types/crmListFilters'

export function buildContactFilterFields(input: {
  customers: { id: string; customerName: string }[]
  designations: string[]
  cities: string[]
  territories: string[]
}): CrmFilterField[] {
  return [
    {
      type: 'search-select',
      key: 'customer',
      label: 'Company',
      options: input.customers.map((c) => ({
        value: c.id,
        label: c.customerName,
      })),
      placeholder: 'Search company…',
    },
    {
      type: 'select',
      key: 'designation',
      label: 'Designation',
      options: input.designations.map((d) => ({ value: d, label: d })),
    },
    {
      type: 'search-select',
      key: 'city',
      label: 'City',
      options: input.cities.map((c) => ({ value: c, label: c })),
      placeholder: 'Search city…',
    },
    {
      type: 'select',
      key: 'territory',
      label: 'Territory',
      options: input.territories.map((t) => ({ value: t, label: t })),
    },
    { type: 'section', label: 'Quick filters' },
    { type: 'boolean', key: 'primaryOnly', label: 'Primary Contacts Only' },
    { type: 'boolean', key: 'overdueOnly', label: 'Overdue Follow-up' },
  ]
}

export function contactFilterChipResolver(
  key: string,
  value: string,
  customers: { id: string; customerName: string }[],
): string | undefined {
  if (key === 'customer') {
    return customers.find((c) => c.id === value)?.customerName
  }
  return undefined
}
