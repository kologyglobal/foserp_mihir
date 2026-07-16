import type { CrmFilterField } from '../types/crmListFilters'
import {
  displayLostReason,
  opportunityStageLabel,
  resolveLostReasonOptions,
  resolveOpportunityStages,
} from '../utils/opportunityUtils'

export function buildOpportunityFilterFields(owners: string[]): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'stage',
      label: 'Stage',
      options: resolveOpportunityStages().map((s) => ({ value: s.id, label: s.label })),
    },
    {
      type: 'search-select',
      key: 'owner',
      label: 'Owner',
      options: owners.map((o) => ({ value: o, label: o })),
      placeholder: 'Search owner…',
    },
    {
      type: 'select',
      key: 'lostReason',
      label: 'Lost Reason',
      options: resolveLostReasonOptions().map((r) => ({ value: r.value, label: r.label })),
    },
  ]
}

export function opportunityFilterChipResolver(key: string, value: string): string | undefined {
  if (key === 'stage') return opportunityStageLabel(value as Parameters<typeof opportunityStageLabel>[0])
  if (key === 'lostReason') return displayLostReason(value)
  return undefined
}
