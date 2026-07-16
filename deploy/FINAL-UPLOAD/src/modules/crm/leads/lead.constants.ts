export const LEAD_STAGES = [
  'new',
  'contacted',
  'requirement_collected',
  'qualified',
  'not_qualified',
  'converted_to_opportunity',
  'closed',
] as const

export const LEAD_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export const LEAD_SOURCES = [
  'website',
  'referral',
  'trade_show',
  'cold_call',
  'existing_customer',
  'other',
  'indiamart',
  'justdial',
  'field_visit',
  'other_channel',
] as const

export const LEAD_LIFECYCLE_STATUSES = ['open', 'qualified', 'converted', 'closed'] as const

export const LEAD_ACTIVITY_STATUSES = ['active', 'inactive'] as const

export const DEFAULT_LEAD_STAGE = 'new'

export const DEFAULT_LEAD_PRIORITY = 'medium'
