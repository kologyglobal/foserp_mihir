export const OPPORTUNITY_STATUSES = ['OPEN', 'WON', 'LOST', 'ON_HOLD', 'ARCHIVED'] as const

export const OPPORTUNITY_PRIORITIES = ['low', 'medium', 'high', 'critical', 'normal', 'strategic'] as const

export const OPPORTUNITY_STAGES = [
  'new_lead',
  'qualified',
  'requirement_discussion',
  'technical_review',
  'quotation_prepared',
  'quotation_sent',
  'negotiation',
  'won',
  'lost',
  'on_hold',
] as const

export const STATUS_TO_FRONTEND: Record<string, string> = {
  OPEN: 'open',
  WON: 'won',
  LOST: 'lost',
  ON_HOLD: 'on_hold',
  ARCHIVED: 'archived',
}

export const FRONTEND_STATUS_TO_DB: Record<string, string> = {
  open: 'OPEN',
  won: 'WON',
  lost: 'LOST',
  on_hold: 'ON_HOLD',
  archived: 'ARCHIVED',
}
