export type EnterpriseStatusTone = 'open' | 'qualified' | 'converted' | 'lost' | 'closed' | 'hold'

const STATUS_ALIASES: Record<string, EnterpriseStatusTone> = {
  open: 'open',
  active: 'open',
  draft: 'hold',
  draft_so: 'hold',
  new: 'open',
  inquiry: 'open',
  qualified: 'qualified',
  contacted: 'qualified',
  approved: 'qualified',
  confirmed: 'qualified',
  in_production: 'open',
  ready_dispatch: 'qualified',
  dispatched: 'qualified',
  sent: 'open',
  pending_approval: 'hold',
  won: 'converted',
  converted: 'converted',
  closed_won: 'converted',
  invoiced: 'converted',
  emerald: 'converted',
  lost: 'lost',
  rejected: 'lost',
  closed_lost: 'lost',
  closed: 'closed',
  inactive: 'closed',
  archived: 'closed',
  hold: 'hold',
  pending: 'hold',
  on_hold: 'hold',
}

export function resolveEnterpriseStatusTone(status: string): EnterpriseStatusTone {
  const key = status.toLowerCase().replace(/\s+/g, '_')
  return STATUS_ALIASES[key] ?? 'open'
}

export function probabilityTier(value: number): 'high' | 'medium' | 'low' {
  if (value >= 70) return 'high'
  if (value >= 40) return 'medium'
  return 'low'
}

export function probabilityLabel(value: number): string {
  const tier = probabilityTier(value)
  if (tier === 'high') return 'High Probability'
  if (tier === 'medium') return 'Medium Probability'
  return 'Low Probability'
}
