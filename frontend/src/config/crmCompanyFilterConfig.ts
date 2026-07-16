import type { CrmFilterField } from '../types/crmListFilters'
import type { CompanyPortfolioFilters } from '../utils/crmCompaniesPortfolio'

export function buildCompanyFilterFields(input: {
  cities: string[]
  territories: string[]
  industries: string[]
  owners: string[]
  types: readonly string[]
}): CrmFilterField[] {
  return [
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
    {
      type: 'select',
      key: 'customerType',
      label: 'Company Type',
      options: input.types.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    },
    {
      type: 'search-select',
      key: 'industry',
      label: 'Industry',
      options: input.industries.map((i) => ({ value: i, label: i })),
      placeholder: 'Search industry…',
    },
    {
      type: 'search-select',
      key: 'owner',
      label: 'Owner',
      options: input.owners.map((o) => ({ value: o, label: o })),
      placeholder: 'Search owner…',
    },
    {
      type: 'select',
      key: 'pipelineStatus',
      label: 'Pipeline Status',
      options: [
        { value: 'active', label: 'Active pipeline' },
        { value: 'none', label: 'No pipeline' },
      ],
    },
    { type: 'section', label: 'Quick filters' },
    { type: 'boolean', key: 'overdueFollowUp', label: 'Overdue Follow-up' },
    { type: 'boolean', key: 'outstandingAr', label: 'Outstanding AR' },
    { type: 'boolean', key: 'activeOpportunity', label: 'Active Opportunity' },
  ]
}

export function companyFiltersToCrmValues(filters: CompanyPortfolioFilters): Record<string, string | boolean | string[]> {
  return {
    search: filters.search,
    city: filters.city,
    territory: filters.territory,
    customerType: filters.customerType,
    industry: filters.industry,
    owner: filters.owner,
    pipelineStatus: filters.pipelineStatus,
    overdueFollowUp: filters.overdueFollowUp,
    outstandingAr: filters.outstandingAr,
    activeOpportunity: filters.activeOpportunity,
    sortBy: filters.sortBy,
  }
}

export function crmValuesToCompanyFilters(
  values: Record<string, string | boolean | string[]>,
  sortBy: CompanyPortfolioFilters['sortBy'],
): CompanyPortfolioFilters {
  const industryRaw = values.industry
  const industry = Array.isArray(industryRaw) ? (industryRaw[0] ?? '') : String(industryRaw ?? '')
  return {
    search: String(values.search ?? ''),
    city: String(values.city ?? ''),
    territory: String(values.territory ?? ''),
    customerType: String(values.customerType ?? ''),
    industry,
    owner: String(values.owner ?? ''),
    pipelineStatus: (values.pipelineStatus as CompanyPortfolioFilters['pipelineStatus']) ?? '',
    overdueFollowUp: values.overdueFollowUp === true,
    outstandingAr: values.outstandingAr === true,
    activeOpportunity: values.activeOpportunity === true,
    sortBy,
  }
}
